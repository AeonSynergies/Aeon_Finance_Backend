import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { createTestOrg, deleteTestOrg } from '../test-utils/test-org';
import { ApprovalsService } from './approvals.service';
import { SubmitBlockedException } from './submit-blocked.exception';

describe('ApprovalsService (integration, real database)', () => {
  let service: ApprovalsService;
  let prisma: PrismaService;
  let testOrg: Awaited<ReturnType<typeof createTestOrg>>;
  let testUserId: string;
  let testJobId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApprovalsService, PrismaService],
    }).compile();

    service = module.get(ApprovalsService);
    prisma = module.get(PrismaService);
    await prisma.$connect();
    testOrg = await createTestOrg(prisma);

    const user = await prisma.user.create({
      data: {
        email: `approvals-service-test-${Date.now()}@aeon.test`,
        passwordHash: 'not-a-real-hash',
        name: 'Approvals Service Test User',
        orgId: testOrg.orgId,
        roleId: testOrg.roleIds.manager,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    await deleteTestOrg(prisma, testOrg.orgId);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const job = await prisma.job.create({
      data: {
        orgId: testOrg.orgId,
        jobId: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        frequency: 'WEEKLY',
        periodStart: new Date('2026-12-06T00:00:00Z'),
        periodEnd: new Date('2026-12-12T00:00:00Z'),
        processDate: new Date('2026-12-15T00:00:00Z'),
        createdById: testUserId,
      },
    });
    testJobId = job.id;
  });

  afterEach(async () => {
    await prisma.auditEntry.deleteMany({ where: { jobId: testJobId } });
    await prisma.dateApproval.deleteMany({ where: { jobId: testJobId } });
    await prisma.timecardRow.deleteMany({ where: { jobId: testJobId } });
    await prisma.job.delete({ where: { id: testJobId } }).catch(() => {});
  });

  async function createRow(date: string, validationStatus = 'GOOD_NO_ERROR') {
    return prisma.timecardRow.create({
      data: {
        jobId: testJobId,
        date: new Date(date),
        rawPayrollName: 'Doe, John',
        validationStatus,
      },
    });
  }

  describe('submit', () => {
    it('throws BadRequestException when no rows exist for that date', async () => {
      await expect(
        service.submit(testJobId, '2026-12-07', testUserId, testOrg.orgId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws SubmitBlockedException when a row is unresolved', async () => {
      await createRow('2026-12-07', 'MISSING_PAYROLL_LOGIN');

      await expect(
        service.submit(testJobId, '2026-12-07', testUserId, testOrg.orgId),
      ).rejects.toThrow(SubmitBlockedException);
    });

    it('succeeds when every row is GOOD_NO_ERROR', async () => {
      await createRow('2026-12-07');

      const result = await service.submit(
        testJobId,
        '2026-12-07',
        testUserId,
        testOrg.orgId,
      );

      expect(result.status).toBe('SENT_FOR_APPROVAL');
    });
  });

  describe('approve', () => {
    it('throws ConflictException when the date was never submitted', async () => {
      await expect(
        service.approve(testJobId, '2026-12-07', testUserId, testOrg.orgId),
      ).rejects.toThrow(ConflictException);
    });

    it('Q: approving a date sets every row for that date to approvalStatus APPROVED', async () => {
      const row = await createRow('2026-12-07');
      expect(row.approvalStatus).toBe('PENDING');
      await service.submit(testJobId, '2026-12-07', testUserId, testOrg.orgId);

      const result = await service.approve(
        testJobId,
        '2026-12-07',
        testUserId,
        testOrg.orgId,
      );
      expect(result.status).toBe('APPROVED');

      const updatedRow = await prisma.timecardRow.findUnique({
        where: { id: row.id },
      });
      expect(updatedRow?.approvalStatus).toBe('APPROVED');
    });

    it('does not touch rows on a different date', async () => {
      const rowOnTargetDate = await createRow('2026-12-07');
      const rowOnOtherDate = await createRow('2026-12-08');
      await service.submit(testJobId, '2026-12-07', testUserId, testOrg.orgId);

      await service.approve(testJobId, '2026-12-07', testUserId, testOrg.orgId);

      const untouched = await prisma.timecardRow.findUnique({
        where: { id: rowOnOtherDate.id },
      });
      expect(untouched?.approvalStatus).toBe('PENDING');
      const touched = await prisma.timecardRow.findUnique({
        where: { id: rowOnTargetDate.id },
      });
      expect(touched?.approvalStatus).toBe('APPROVED');
    });
  });

  describe('reject', () => {
    it('throws ConflictException when the date was never submitted', async () => {
      await expect(
        service.reject(
          testJobId,
          '2026-12-07',
          { rejectionComments: 'test' },
          testUserId,
          testOrg.orgId,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('Q: rejecting a date sets every row for that date back to approvalStatus PENDING, and the date itself back to IN_PROGRESS', async () => {
      const row = await createRow('2026-12-07');
      await service.submit(testJobId, '2026-12-07', testUserId, testOrg.orgId);
      await service.approve(testJobId, '2026-12-07', testUserId, testOrg.orgId);

      const rowB = await createRow('2026-12-08');
      await service.submit(testJobId, '2026-12-08', testUserId, testOrg.orgId);

      const result = await service.reject(
        testJobId,
        '2026-12-08',
        { rejectionComments: 'Needs another look' },
        testUserId,
        testOrg.orgId,
      );
      expect(result.status).toBe('IN_PROGRESS');

      const updatedRow = await prisma.timecardRow.findUnique({
        where: { id: rowB.id },
      });
      expect(updatedRow?.approvalStatus).toBe('PENDING');

      const approvedRow = await prisma.timecardRow.findUnique({
        where: { id: row.id },
      });
      expect(approvedRow?.approvalStatus).toBe('APPROVED');
    });
  });

  describe('findAllDates', () => {
    it('lists DateApproval rows chronologically', async () => {
      await createRow('2026-12-07');
      await service.submit(testJobId, '2026-12-07', testUserId, testOrg.orgId);

      const dates = await service.findAllDates(testJobId, testOrg.orgId);

      expect(dates).toHaveLength(1);
      expect(dates[0].status).toBe('SENT_FOR_APPROVAL');
    });
  });
});

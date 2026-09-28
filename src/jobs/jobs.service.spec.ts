import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { createTestOrg, deleteTestOrg } from '../test-utils/test-org';
import { JobsService } from './jobs.service';

describe('JobsService.lock (integration, real database)', () => {
  let service: JobsService;
  let prisma: PrismaService;
  let testOrg: Awaited<ReturnType<typeof createTestOrg>>;
  let testUserId: string;
  let testJobId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobsService, PrismaService],
    }).compile();

    service = module.get(JobsService);
    prisma = module.get(PrismaService);
    await prisma.$connect();
    testOrg = await createTestOrg(prisma);

    const user = await prisma.user.create({
      data: {
        email: `jobs-service-test-${Date.now()}@aeon.test`,
        passwordHash: 'not-a-real-hash',
        name: 'Jobs Service Test User',
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
        frequency: 'DAILY',
        periodStart: new Date('2026-12-07T00:00:00Z'),
        periodEnd: new Date('2026-12-07T00:00:00Z'),
        processDate: new Date('2026-12-08T00:00:00Z'),
        createdById: testUserId,
      },
    });
    testJobId = job.id;
  });

  afterEach(async () => {
    await prisma.auditEntry.deleteMany({ where: { jobId: testJobId } });
    await prisma.dateApproval.deleteMany({ where: { jobId: testJobId } });
    await prisma.job.delete({ where: { id: testJobId } }).catch(() => {});
  });

  it('throws NotFoundException for a non-existent job', async () => {
    await expect(
      service.lock('does-not-exist', testUserId, testOrg.orgId),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when not every date in the period is approved yet', async () => {
    await expect(
      service.lock(testJobId, testUserId, testOrg.orgId),
    ).rejects.toThrow(ConflictException);
  });

  it('locks the job once every date in the period is approved, and writes an audit entry', async () => {
    await prisma.dateApproval.create({
      data: {
        jobId: testJobId,
        date: new Date('2026-12-07T00:00:00Z'),
        status: 'APPROVED',
        decidedById: testUserId,
        decidedAt: new Date(),
      },
    });

    const result = await service.lock(testJobId, testUserId, testOrg.orgId);

    expect(result.status).toBe('LOCKED');
    expect(result.lockedAt).not.toBeNull();

    const audit = await prisma.auditEntry.findFirst({
      where: { jobId: testJobId, action: 'LOCK' },
    });
    expect(audit).not.toBeNull();
  });

  it('throws ConflictException when trying to lock an already-locked job', async () => {
    await prisma.dateApproval.create({
      data: {
        jobId: testJobId,
        date: new Date('2026-12-07T00:00:00Z'),
        status: 'APPROVED',
        decidedById: testUserId,
        decidedAt: new Date(),
      },
    });
    await service.lock(testJobId, testUserId, testOrg.orgId);

    await expect(
      service.lock(testJobId, testUserId, testOrg.orgId),
    ).rejects.toThrow(ConflictException);
  });
});

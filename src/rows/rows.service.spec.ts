import { randomUUID } from 'crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createTestOrg, deleteTestOrg } from '../test-utils/test-org';
import { SettingsService } from '../settings/settings.service';
import type { GroupedPayrollDay } from '../engines/timecard/ingestion/payrollExport';
import type { AmazonItineraryDay } from '../engines/timecard/ingestion/amazonItinerary';
import type { AmazonBreakDay } from '../engines/timecard/ingestion/breakReport';
import { RowsService } from './rows.service';

describe('RowsService (integration, real database)', () => {
  let service: RowsService;
  let prisma: PrismaService;
  let testOrg: Awaited<ReturnType<typeof createTestOrg>>;
  let testUserId: string;
  let testJobId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RowsService, PrismaService, SettingsService],
    }).compile();

    service = module.get(RowsService);
    prisma = module.get(PrismaService);
    await prisma.$connect();
    testOrg = await createTestOrg(prisma);

    const user = await prisma.user.create({
      data: {
        email: `rows-service-test-${Date.now()}@aeon.test`,
        passwordHash: 'not-a-real-hash',
        name: 'Rows Service Test User',
        orgId: testOrg.orgId,
        roleId: testOrg.roleIds.executive,
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
    const rows = await prisma.timecardRow.findMany({
      where: { jobId: testJobId },
      select: { id: true },
    });
    const rowIds = rows.map((r) => r.id);
    await prisma.auditEntry.deleteMany({ where: { jobId: testJobId } });
    await prisma.override.deleteMany({
      where: { timecardRowId: { in: rowIds } },
    });
    await prisma.timecardRow.deleteMany({ where: { jobId: testJobId } });
    await prisma.uploadedDocument.deleteMany({ where: { jobId: testJobId } });
    await prisma.job.delete({ where: { id: testJobId } }).catch(() => {});
  });

  async function seedPayroll(payrollDays: GroupedPayrollDay[], version = 1) {
    return prisma.uploadedDocument.create({
      data: {
        jobId: testJobId,
        docType: 'PAYROLL_TIMECARD',
        fileName: 'payroll.xlsx',
        checksum: randomUUID(),
        version,
        date: null,
        fileContent: Buffer.from('test'),
        parsedData: payrollDays as unknown as Prisma.InputJsonValue,
        uploadedById: testUserId,
      },
    });
  }

  async function seedItinerary(
    date: string,
    itineraryDays: AmazonItineraryDay[],
    version = 1,
  ) {
    return prisma.uploadedDocument.create({
      data: {
        jobId: testJobId,
        docType: 'AMAZON_ACTIVITY',
        fileName: `itinerary-${date}.xlsx`,
        checksum: randomUUID(),
        version,
        date: new Date(date),
        fileContent: Buffer.from('test'),
        parsedData: itineraryDays as unknown as Prisma.InputJsonValue,
        uploadedById: testUserId,
      },
    });
  }

  async function seedBreakReport(
    date: string,
    breakDays: AmazonBreakDay[],
    version = 1,
  ) {
    return prisma.uploadedDocument.create({
      data: {
        jobId: testJobId,
        docType: 'AMAZON_BREAK',
        fileName: `break-${date}.csv`,
        checksum: randomUUID(),
        version,
        date: new Date(date),
        fileContent: Buffer.from('test'),
        parsedData: breakDays as unknown as Prisma.InputJsonValue,
        uploadedById: testUserId,
      },
    });
  }

  describe('validateAndPersist', () => {
    it('throws NotFoundException for a non-existent job', async () => {
      await expect(
        service.validateAndPersist('does-not-exist', testOrg.orgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when Payroll Export has not been uploaded', async () => {
      await seedItinerary('2026-12-07', [
        {
          amazonName: 'Jose,Alarcon',
          date: '2026-12-07',
          appLogin: '10:45',
          appLogout: '20:19',
          lastStop: '20:00',
        },
      ]);

      await expect(
        service.validateAndPersist(testJobId, testOrg.orgId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when Amazon Itinerary has not been uploaded', async () => {
      await seedPayroll([
        {
          payrollName: 'Alarcon, Jose',
          payDate: '2026-12-07',
          payLogin: '10:45',
          payLogout: '20:19',
          payLogins: ['10:45'],
          payLogouts: ['20:19'],
          payBreaks: [],
          payBreakOut: null,
          payBreakIn: null,
          earnCode: 'REG',
        },
      ]);

      await expect(
        service.validateAndPersist(testJobId, testOrg.orgId),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists a real engine result for a clean driver (Amazon Break Report omitted, since it is optional)', async () => {
      await seedPayroll([
        {
          payrollName: 'Alarcon, Jose',
          payDate: '2026-12-07',
          payLogin: '10:45',
          payLogout: '20:19',
          payLogins: ['10:45'],
          payLogouts: ['20:19'],
          payBreaks: [{ breakOut: '16:47', breakIn: '17:17' }],
          payBreakOut: '16:47',
          payBreakIn: '17:17',
          earnCode: 'REG',
        },
      ]);
      await seedItinerary('2026-12-07', [
        {
          amazonName: 'Jose,Alarcon',
          date: '2026-12-07',
          appLogin: '10:45',
          appLogout: '20:19',
          lastStop: '20:00',
        },
      ]);
      await seedBreakReport('2026-12-07', [
        {
          amazonName: 'Jose Alarcon',
          date: '2026-12-07',
          segments: [{ breakOut: '16:47', breakIn: '17:17' }],
        },
      ]);

      const result = await service.validateAndPersist(testJobId, testOrg.orgId);

      expect(result).toHaveLength(1);
      expect(result[0].rawPayrollName).toBe('Alarcon, Jose');
      expect(result[0].rawAmazonName).toBe('Jose,Alarcon');
      expect(result[0].validationStatus).toBe('GOOD_NO_ERROR');
    });

    it('deduplicates two payroll entries for the same driver+date, keeping the last one', async () => {
      await seedPayroll([
        {
          payrollName: 'Smith, Jane',
          payDate: '2026-12-07',
          payLogin: '08:00',
          payLogout: '17:00',
          payLogins: ['08:00'],
          payLogouts: ['17:00'],
          payBreaks: [],
          payBreakOut: null,
          payBreakIn: null,
          earnCode: 'REG',
        },
        {
          payrollName: 'Smith, Jane',
          payDate: '2026-12-07',
          payLogin: '09:00',
          payLogout: '17:00',
          payLogins: ['09:00'],
          payLogouts: ['17:00'],
          payBreaks: [],
          payBreakOut: null,
          payBreakIn: null,
          earnCode: 'REG',
        },
      ]);
      await seedItinerary('2026-12-07', [
        {
          amazonName: 'Jane,Smith',
          date: '2026-12-07',
          appLogin: '09:00',
          appLogout: '17:00',
          lastStop: '16:55',
        },
      ]);

      const result = await service.validateAndPersist(testJobId, testOrg.orgId);

      expect(result).toHaveLength(1);
      expect(result[0].payLogin).toBe('09:00');

      const dbRowCount = await prisma.timecardRow.count({
        where: { jobId: testJobId },
      });
      expect(dbRowCount).toBe(1);
    });

    it('upserts on re-validation instead of creating a duplicate row', async () => {
      await seedPayroll([
        {
          payrollName: 'Doe, John',
          payDate: '2026-12-08',
          payLogin: '08:00',
          payLogout: '17:00',
          payLogins: ['08:00'],
          payLogouts: ['17:00'],
          payBreaks: [],
          payBreakOut: null,
          payBreakIn: null,
          earnCode: 'REG',
        },
      ]);
      await seedItinerary('2026-12-08', [
        {
          amazonName: 'John,Doe',
          date: '2026-12-08',
          appLogin: '08:00',
          appLogout: '17:00',
          lastStop: '16:55',
        },
      ]);

      const first = await service.validateAndPersist(testJobId, testOrg.orgId);
      const second = await service.validateAndPersist(testJobId, testOrg.orgId);

      expect(first[0].id).toBe(second[0].id);
      const count = await prisma.timecardRow.count({
        where: { jobId: testJobId },
      });
      expect(count).toBe(1);
    });

    it('uses only the latest version of the Payroll Export when a corrected file was uploaded', async () => {
      await seedPayroll(
        [
          {
            payrollName: 'Doe, John',
            payDate: '2026-12-08',
            payLogin: '08:00',
            payLogout: '17:00',
            payLogins: ['08:00'],
            payLogouts: ['17:00'],
            payBreaks: [],
            payBreakOut: null,
            payBreakIn: null,
            earnCode: 'REG',
          },
        ],
        1,
      );
      await seedPayroll(
        [
          {
            payrollName: 'Doe, John',
            payDate: '2026-12-08',
            payLogin: '08:15',
            payLogout: '17:00',
            payLogins: ['08:15'],
            payLogouts: ['17:00'],
            payBreaks: [],
            payBreakOut: null,
            payBreakIn: null,
            earnCode: 'REG',
          },
        ],
        2,
      );
      await seedItinerary('2026-12-08', [
        {
          amazonName: 'John,Doe',
          date: '2026-12-08',
          appLogin: '08:15',
          appLogout: '17:00',
          lastStop: '16:55',
        },
      ]);

      const result = await service.validateAndPersist(testJobId, testOrg.orgId);

      expect(result).toHaveLength(1);
      expect(result[0].payLogin).toBe('08:15');
    });

    it('scopes Itinerary versioning per date: an older version for one date does not shadow a newer upload for another date', async () => {
      await seedPayroll([
        {
          payrollName: 'Doe, John',
          payDate: '2026-12-07',
          payLogin: '09:00',
          payLogout: '17:00',
          payLogins: ['09:00'],
          payLogouts: ['17:00'],
          payBreaks: [],
          payBreakOut: null,
          payBreakIn: null,
          earnCode: 'REG',
        },
        {
          payrollName: 'Doe, John',
          payDate: '2026-12-08',
          payLogin: '09:00',
          payLogout: '17:00',
          payLogins: ['09:00'],
          payLogouts: ['17:00'],
          payBreaks: [],
          payBreakOut: null,
          payBreakIn: null,
          earnCode: 'REG',
        },
      ]);
      await seedItinerary(
        '2026-12-07',
        [
          {
            amazonName: 'John,Doe',
            date: '2026-12-07',
            appLogin: '09:45',
            appLogout: '17:00',
            lastStop: '16:55',
          },
        ],
        1,
      );
      await seedItinerary(
        '2026-12-08',
        [
          {
            amazonName: 'John,Doe',
            date: '2026-12-08',
            appLogin: '09:00',
            appLogout: '17:00',
            lastStop: '16:55',
          },
        ],
        1,
      );

      const result = await service.validateAndPersist(testJobId, testOrg.orgId);

      const day1 = result.find(
        (r) => r.date.toISOString().slice(0, 10) === '2026-12-07',
      );
      const day2 = result.find(
        (r) => r.date.toISOString().slice(0, 10) === '2026-12-08',
      );
      expect(day1?.validationStatus).toBe('LOGIN_TIME_DIFFERENCE');
      expect(day2?.validationStatus).toBe('GOOD_NO_ERROR');
    });
  });

  describe('findAll', () => {
    it('filters by date and by status', async () => {
      await seedPayroll([
        {
          payrollName: 'Alarcon, Jose',
          payDate: '2026-12-07',
          payLogin: null,
          payLogout: '17:00',
          payLogins: [],
          payLogouts: ['17:00'],
          payBreaks: [],
          payBreakOut: null,
          payBreakIn: null,
          earnCode: 'REG',
        },
      ]);
      await seedItinerary('2026-12-07', [
        {
          amazonName: 'Jose,Alarcon',
          date: '2026-12-07',
          appLogin: '10:45',
          appLogout: '17:05',
          lastStop: '16:50',
        },
      ]);
      await service.validateAndPersist(testJobId, testOrg.orgId);

      const byDate = await service.findAll(
        testJobId,
        testOrg.orgId,
        '2026-12-07',
      );
      expect(byDate).toHaveLength(1);

      const byWrongDate = await service.findAll(
        testJobId,
        testOrg.orgId,
        '2026-12-08',
      );
      expect(byWrongDate).toHaveLength(0);

      const byStatus = await service.findAll(
        testJobId,
        testOrg.orgId,
        undefined,
        'MISSING_PAYROLL_LOGIN',
      );
      expect(byStatus).toHaveLength(1);

      const byWrongStatus = await service.findAll(
        testJobId,
        testOrg.orgId,
        undefined,
        'GOOD_NO_ERROR',
      );
      expect(byWrongStatus).toHaveLength(0);
    });
  });

  describe('override', () => {
    it('throws NotFoundException when the row does not belong to the given job', async () => {
      await seedPayroll([
        {
          payrollName: 'Doe, John',
          payDate: '2026-12-09',
          payLogin: '08:00',
          payLogout: '17:00',
          payLogins: ['08:00'],
          payLogouts: ['17:00'],
          payBreaks: [],
          payBreakOut: null,
          payBreakIn: null,
          earnCode: 'REG',
        },
      ]);
      await seedItinerary('2026-12-09', [
        {
          amazonName: 'John,Doe',
          date: '2026-12-09',
          appLogin: '08:00',
          appLogout: '17:00',
          lastStop: '16:55',
        },
      ]);
      const rows = await service.validateAndPersist(testJobId, testOrg.orgId);

      await expect(
        service.override(
          'wrong-job-id',
          rows[0].id,
          { newStatus: 'GOOD_NO_ERROR', reason: 'test' },
          testUserId,
          testOrg.orgId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('atomically creates an Override + AuditEntry and updates the row', async () => {
      await seedPayroll([
        {
          payrollName: 'Smith, Jane',
          payDate: '2026-12-10',
          payLogin: null,
          payLogout: '17:00',
          payLogins: [],
          payLogouts: ['17:00'],
          payBreaks: [],
          payBreakOut: null,
          payBreakIn: null,
          earnCode: 'REG',
        },
      ]);
      await seedItinerary('2026-12-10', [
        {
          amazonName: 'Jane,Smith',
          date: '2026-12-10',
          appLogin: '08:00',
          appLogout: '17:00',
          lastStop: '16:45',
        },
      ]);
      const rows = await service.validateAndPersist(testJobId, testOrg.orgId);
      const rowId = rows[0].id;
      expect(rows[0].validationStatus).toBe('MISSING_PAYROLL_LOGIN');

      const updated = await service.override(
        testJobId,
        rowId,
        {
          newStatus: 'GOOD_NO_ERROR',
          reason: 'Confirmed with driver.',
          note: 'Called dispatch.',
        },
        testUserId,
        testOrg.orgId,
      );

      expect(updated.validationStatus).toBe('GOOD_NO_ERROR');
      expect(updated.overrideNote).toBe('Confirmed with driver.');
      expect(updated.overriddenById).toBe(testUserId);

      const override = await prisma.override.findFirst({
        where: { timecardRowId: rowId },
      });
      expect(override).not.toBeNull();
      expect(override?.previousStatus).toBe('MISSING_PAYROLL_LOGIN');
      expect(override?.newStatus).toBe('GOOD_NO_ERROR');
      expect(override?.note).toBe('Called dispatch.');

      const audit = await prisma.auditEntry.findFirst({
        where: { timecardRowId: rowId, action: 'OVERRIDE' },
      });
      expect(audit).not.toBeNull();
      expect(audit?.detail).toContain('MISSING_PAYROLL_LOGIN');
      expect(audit?.detail).toContain('GOOD_NO_ERROR');
    });
  });
});

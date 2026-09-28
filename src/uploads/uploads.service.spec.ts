import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Workbook } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { createTestOrg, deleteTestOrg } from '../test-utils/test-org';
import { UploadsService } from './uploads.service';

async function buildPayrollWorkbookBuffer(
  rows: (string | number | Date)[][],
): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('1');
  sheet.addRow([
    'Company Code',
    'Payroll Name',
    'File Number',
    'Pay Date',
    'Time In',
    'Time Out',
    'Hours',
    'Earnings Code',
    'Worked Department',
  ]);
  rows.forEach((row) => sheet.addRow(row));
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

async function buildItineraryWorkbookBuffer(
  rows: (string | number)[][],
): Promise<Buffer> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Itineraries');
  sheet.addRow(['Driver name', 'App sign in:', 'App sign out:']);
  rows.forEach((row) => sheet.addRow(row));
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

function buildBreakReportCsvBuffer(date: string, dataRows: string[]): Buffer {
  const lines = [
    `Date:,${date},,,,,`,
    'DA Transporter ID:,DA Name:,Break Start Time,Break End Time,Break Duration in Minutes,Report Source,Break Type',
    ...dataRows,
  ];
  return Buffer.from(lines.join('\n'));
}

function fakeFile(buffer: Buffer, originalname: string): Express.Multer.File {
  return {
    buffer,
    originalname,
    fieldname: 'file',
    mimetype: 'application/octet-stream',
    size: buffer.length,
  } as Express.Multer.File;
}

describe('UploadsService (integration, real database)', () => {
  let service: UploadsService;
  let prisma: PrismaService;
  let testOrg: Awaited<ReturnType<typeof createTestOrg>>;
  let testUserId: string;
  let testJobId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadsService, PrismaService],
    }).compile();

    service = module.get(UploadsService);
    prisma = module.get(PrismaService);
    await prisma.$connect();
    testOrg = await createTestOrg(prisma);

    const user = await prisma.user.create({
      data: {
        email: `uploads-service-test-${Date.now()}@aeon.test`,
        passwordHash: 'not-a-real-hash',
        name: 'Uploads Service Test User',
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
        jobId: `TEST-UPLOADS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    await prisma.uploadedDocument.deleteMany({ where: { jobId: testJobId } });
    await prisma.job.delete({ where: { id: testJobId } }).catch(() => {});
  });

  it('throws NotFoundException for a non-existent job', async () => {
    const buffer = await buildPayrollWorkbookBuffer([
      [
        '6WY',
        'Doe, John',
        '1',
        new Date('2026-12-07'),
        '09:00 AM',
        '05:00 PM',
        8,
        '',
        '1',
      ],
    ]);
    await expect(
      service.upload(
        'does-not-exist',
        { docType: 'PAYROLL_TIMECARD' },
        fakeFile(buffer, 'payroll.xlsx'),
        testUserId,
        testOrg.orgId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('parses and persists a real-shaped Payroll Export upload', async () => {
    const buffer = await buildPayrollWorkbookBuffer([
      [
        '6WY',
        'Doe, John',
        '1',
        new Date('2026-12-07'),
        '09:00 AM',
        '05:00 PM',
        8,
        '',
        '1',
      ],
    ]);

    const result = await service.upload(
      testJobId,
      { docType: 'PAYROLL_TIMECARD' },
      fakeFile(buffer, 'payroll.xlsx'),
      testUserId,
      testOrg.orgId,
    );

    expect(result.docType).toBe('PAYROLL_TIMECARD');
    expect(result.version).toBe(1);
    expect(result.rowCount).toBe(1);
    expect(result.date).toBeNull();

    const stored = await prisma.uploadedDocument.findUnique({
      where: { id: result.id },
    });
    expect(stored?.fileContent).toBeTruthy();
    expect(Array.isArray(stored?.parsedData)).toBe(true);

    const audit = await prisma.auditEntry.findFirst({
      where: { jobId: testJobId, action: 'UPLOAD' },
    });
    expect(audit).not.toBeNull();
  });

  it('is idempotent: re-uploading identical content returns the existing version, not a new one', async () => {
    const buffer = await buildPayrollWorkbookBuffer([
      [
        '6WY',
        'Doe, John',
        '1',
        new Date('2026-12-07'),
        '09:00 AM',
        '05:00 PM',
        8,
        '',
        '1',
      ],
    ]);

    const first = await service.upload(
      testJobId,
      { docType: 'PAYROLL_TIMECARD' },
      fakeFile(buffer, 'payroll.xlsx'),
      testUserId,
      testOrg.orgId,
    );
    const second = await service.upload(
      testJobId,
      { docType: 'PAYROLL_TIMECARD' },
      fakeFile(buffer, 'payroll.xlsx'),
      testUserId,
      testOrg.orgId,
    );

    expect(second.id).toBe(first.id);
    expect(second.version).toBe(1);

    const count = await prisma.uploadedDocument.count({
      where: { jobId: testJobId },
    });
    expect(count).toBe(1);
  });

  it('increments version when a corrected file with different content is uploaded', async () => {
    const original = await buildPayrollWorkbookBuffer([
      [
        '6WY',
        'Doe, John',
        '1',
        new Date('2026-12-07'),
        '09:00 AM',
        '05:00 PM',
        8,
        '',
        '1',
      ],
    ]);
    const corrected = await buildPayrollWorkbookBuffer([
      [
        '6WY',
        'Doe, John',
        '1',
        new Date('2026-12-07'),
        '09:15 AM',
        '05:00 PM',
        8,
        '',
        '1',
      ],
    ]);

    const first = await service.upload(
      testJobId,
      { docType: 'PAYROLL_TIMECARD' },
      fakeFile(original, 'payroll.xlsx'),
      testUserId,
      testOrg.orgId,
    );
    const second = await service.upload(
      testJobId,
      { docType: 'PAYROLL_TIMECARD' },
      fakeFile(corrected, 'payroll-corrected.xlsx'),
      testUserId,
      testOrg.orgId,
    );

    expect(second.id).not.toBe(first.id);
    expect(second.version).toBe(2);
  });

  it('throws BadRequestException when AMAZON_ACTIVITY is uploaded without a date', async () => {
    const buffer = await buildItineraryWorkbookBuffer([
      ['Doe, John', '09:00am', '05:00pm'],
    ]);

    await expect(
      service.upload(
        testJobId,
        { docType: 'AMAZON_ACTIVITY' },
        fakeFile(buffer, 'itinerary.xlsx'),
        testUserId,
        testOrg.orgId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('tags an AMAZON_ACTIVITY upload with the supplied date, and scopes versioning per date', async () => {
    const buffer1 = await buildItineraryWorkbookBuffer([
      ['Doe, John', '09:00am', '05:00pm'],
    ]);
    const buffer2 = await buildItineraryWorkbookBuffer([
      ['Doe, John', '09:15am', '05:15pm'],
    ]);

    const day1 = await service.upload(
      testJobId,
      { docType: 'AMAZON_ACTIVITY', date: '2026-12-07' } as never,
      fakeFile(buffer1, 'itinerary-day1.xlsx'),
      testUserId,
      testOrg.orgId,
    );
    const day2 = await service.upload(
      testJobId,
      { docType: 'AMAZON_ACTIVITY', date: '2026-12-08' } as never,
      fakeFile(buffer2, 'itinerary-day2.xlsx'),
      testUserId,
      testOrg.orgId,
    );

    expect(day1.date).not.toBeNull();
    expect(day2.date).not.toBeNull();
    expect(day1.version).toBe(1);
    expect(day2.version).toBe(1);
    expect(day1.id).not.toBe(day2.id);
  });

  it('idempotency is checksum-based, not date-claim-based: re-uploading identical bytes under a different date is still a no-op of the original', async () => {
    const buffer = await buildItineraryWorkbookBuffer([
      ['Doe, John', '09:00am', '05:00pm'],
    ]);

    const day1 = await service.upload(
      testJobId,
      { docType: 'AMAZON_ACTIVITY', date: '2026-12-07' } as never,
      fakeFile(buffer, 'itinerary-day1.xlsx'),
      testUserId,
      testOrg.orgId,
    );
    const relabeled = await service.upload(
      testJobId,
      { docType: 'AMAZON_ACTIVITY', date: '2026-12-08' } as never,
      fakeFile(buffer, 'itinerary-day1-relabeled.xlsx'),
      testUserId,
      testOrg.orgId,
    );

    expect(relabeled.id).toBe(day1.id);
    expect(relabeled.date).toEqual(day1.date);

    const count = await prisma.uploadedDocument.count({
      where: { jobId: testJobId },
    });
    expect(count).toBe(1);
  });

  it('auto-detects the date from Amazon Break Report metadata, not a DTO field', async () => {
    const buffer = buildBreakReportCsvBuffer('2026-12-07', [
      'A1,Doe John,15:00:00,15:30:00,30,Delivery App,REST',
    ]);

    const result = await service.upload(
      testJobId,
      { docType: 'AMAZON_BREAK' },
      fakeFile(buffer, 'break-report.csv'),
      testUserId,
      testOrg.orgId,
    );

    expect(result.date).not.toBeNull();
    expect(result.rowCount).toBe(1);
  });

  it('throws BadRequestException when the Break Report has no detectable Date: metadata line', async () => {
    const buffer = Buffer.from(
      [
        'DA Transporter ID:,DA Name:,Break Start Time,Break End Time,Break Duration in Minutes,Report Source,Break Type',
        'A1,Doe John,15:00:00,15:30:00,30,Delivery App,REST',
      ].join('\n'),
    );

    await expect(
      service.upload(
        testJobId,
        { docType: 'AMAZON_BREAK' },
        fakeFile(buffer, 'break-report.csv'),
        testUserId,
        testOrg.orgId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException with a clear message when a Payroll Export file is missing required columns', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('1');
    sheet.addRow(['Time In', 'Time Out']);
    sheet.addRow(['09:00 AM', '05:00 PM']);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    await expect(
      service.upload(
        testJobId,
        { docType: 'PAYROLL_TIMECARD' },
        fakeFile(buffer, 'bad-payroll.xlsx'),
        testUserId,
        testOrg.orgId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('stores (but does not parse) doc types with no parser built yet', async () => {
    const buffer = Buffer.from('anything at all');

    const result = await service.upload(
      testJobId,
      { docType: 'EMPLOYEE_MASTER' },
      fakeFile(buffer, 'employee-master.xlsx'),
      testUserId,
      testOrg.orgId,
    );

    expect(result.rowCount).toBeNull();
    expect(result.date).toBeNull();
  });

  it('findAll lists uploads for a job without leaking fileContent', async () => {
    const buffer = await buildPayrollWorkbookBuffer([
      [
        '6WY',
        'Doe, John',
        '1',
        new Date('2026-12-07'),
        '09:00 AM',
        '05:00 PM',
        8,
        '',
        '1',
      ],
    ]);
    await service.upload(
      testJobId,
      { docType: 'PAYROLL_TIMECARD' },
      fakeFile(buffer, 'payroll.xlsx'),
      testUserId,
      testOrg.orgId,
    );

    const list = await service.findAll(testJobId, testOrg.orgId);

    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('fileContent');
    expect(list[0].rowCount).toBe(1);
  });

  it('findAll throws NotFoundException for a non-existent job', async () => {
    await expect(
      service.findAll('does-not-exist', testOrg.orgId),
    ).rejects.toThrow(NotFoundException);
  });
});

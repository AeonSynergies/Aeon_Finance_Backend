import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UploadDocType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { buildTimecardRows } from '../engines/timecard/ingestion/buildTimecardRows';
import type { GroupedPayrollDay } from '../engines/timecard/ingestion/payrollExport';
import type { AmazonItineraryDay } from '../engines/timecard/ingestion/amazonItinerary';
import type { AmazonBreakDay } from '../engines/timecard/ingestion/breakReport';
import { validateTimecardRow } from '../engines/timecard/sequencer';
import { OverrideRowDto } from './dto/override-row.dto';

function dedupePayrollDays(
  payrollDays: GroupedPayrollDay[],
): GroupedPayrollDay[] {
  const byKey = new Map<string, GroupedPayrollDay>();
  for (const day of payrollDays) {
    byKey.set(`${day.payrollName}|${day.payDate}`, day);
  }
  return [...byKey.values()];
}

interface UploadedDocumentRecord {
  docType: UploadDocType;
  date: Date | null;
  version: number;
  parsedData: Prisma.JsonValue;
}

function latestPerSupersessionKey<T extends UploadedDocumentRecord>(
  docs: T[],
): T[] {
  const latestByKey = new Map<string, T>();
  for (const doc of docs) {
    const key = doc.date
      ? `${doc.docType}|${doc.date.toISOString().slice(0, 10)}`
      : doc.docType;
    const existing = latestByKey.get(key);
    if (!existing || doc.version > existing.version) {
      latestByKey.set(key, doc);
    }
  }
  return [...latestByKey.values()];
}

@Injectable()
export class RowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async validateAndPersist(jobId: string, orgId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, orgId },
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const allDocs = await this.prisma.uploadedDocument.findMany({
      where: { jobId },
    });
    const latestDocs = latestPerSupersessionKey(allDocs);

    const payrollDoc = latestDocs.find(
      (d) => d.docType === UploadDocType.PAYROLL_TIMECARD,
    );
    if (!payrollDoc || payrollDoc.parsedData === null) {
      throw new BadRequestException(
        'Payroll Export has not been uploaded for this job yet',
      );
    }

    const itineraryDocs = latestDocs.filter(
      (d) => d.docType === UploadDocType.AMAZON_ACTIVITY,
    );
    if (itineraryDocs.length === 0) {
      throw new BadRequestException(
        'Amazon Itinerary has not been uploaded for this job yet',
      );
    }

    const breakDocs = latestDocs.filter(
      (d) => d.docType === UploadDocType.AMAZON_BREAK,
    );

    const payrollDays = dedupePayrollDays(
      payrollDoc.parsedData as unknown as GroupedPayrollDay[],
    );
    const itineraryDays = itineraryDocs.flatMap(
      (d) => d.parsedData as unknown as AmazonItineraryDay[],
    );
    const breakDays = breakDocs.flatMap(
      (d) => d.parsedData as unknown as AmazonBreakDay[],
    );

    const thresholds = await this.settingsService.getThresholds(orgId);

    const timecardRowInputs = buildTimecardRows(
      payrollDays,
      itineraryDays,
      breakDays,
    );

    const upserts = timecardRowInputs.map((rowInput, index) => {
      const payrollDay = payrollDays[index];
      const result = validateTimecardRow(rowInput, thresholds);
      const date = new Date(payrollDay.payDate);

      const shared = {
        rawAmazonName: result.employeeId,
        earnCode: rowInput.earnCode,
        payLogin: rowInput.payLogin,
        payLogout: rowInput.payLogout,
        payBreakOut: rowInput.payBreakOut,
        payBreakIn: rowInput.payBreakIn,
        payLogins: rowInput.payLogins,
        payLogouts: rowInput.payLogouts,
        payBreaks: rowInput.payBreaks as unknown as Prisma.InputJsonValue,
        appLogin: rowInput.appLogin,
        appLogout: rowInput.appLogout,
        physicalLogin: rowInput.physicalLogin,
        lastStop: rowInput.lastStop,
        amazonBreaks: rowInput.amazonBreaks as unknown as Prisma.InputJsonValue,
        validationStatus: result.status,
        triggeredRule: result.triggeredRule,
        additionalTriggeredRules:
          result.additionalTriggeredRules as unknown as Prisma.InputJsonValue,
        detail: result.detail ?? null,
      };

      return this.prisma.timecardRow.upsert({
        where: {
          jobId_date_rawPayrollName: {
            jobId,
            date,
            rawPayrollName: payrollDay.payrollName,
          },
        },
        create: {
          jobId,
          date,
          rawPayrollName: payrollDay.payrollName,
          ...shared,
        },
        update: shared,
      });
    });

    return this.prisma.$transaction(upserts);
  }

  async findAll(jobId: string, orgId: string, date?: string, status?: string) {
    await this.ensureJobInOrg(jobId, orgId);
    return this.prisma.timecardRow.findMany({
      where: {
        jobId,
        ...(date ? { date: new Date(date) } : {}),
        ...(status ? { validationStatus: status } : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  async override(
    jobId: string,
    rowId: string,
    dto: OverrideRowDto,
    userId: string,
    orgId: string,
  ) {
    await this.ensureJobInOrg(jobId, orgId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.timecardRow.findUnique({ where: { id: rowId } });
      if (!row || row.jobId !== jobId) {
        throw new NotFoundException(`Row ${rowId} not found for job ${jobId}`);
      }

      await tx.override.create({
        data: {
          timecardRowId: rowId,
          userId,
          previousStatus: row.validationStatus,
          newStatus: dto.newStatus,
          reason: dto.reason,
          note: dto.note,
        },
      });

      const updatedRow = await tx.timecardRow.update({
        where: { id: rowId },
        data: {
          validationStatus: dto.newStatus,
          overrideNote: dto.reason,
          overriddenById: userId,
          overriddenAt: new Date(),
        },
      });

      await tx.auditEntry.create({
        data: {
          jobId,
          timecardRowId: rowId,
          userId,
          action: 'OVERRIDE',
          detail: `Status changed from ${row.validationStatus} to ${dto.newStatus}: ${dto.reason}`,
        },
      });

      return updatedRow;
    });
  }

  /** 404 unless the job exists in the caller's organization. */
  private async ensureJobInOrg(jobId: string, orgId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, orgId },
      select: { id: true },
    });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
  }
}

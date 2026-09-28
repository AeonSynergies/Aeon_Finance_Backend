import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UploadDocType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sha256Checksum } from '../lib/checksum';
import {
  groupPayrollExport,
  parsePayrollExportWorkbook,
} from '../engines/timecard/ingestion/payrollExport';
import {
  parseAmazonItinerary,
  parseAmazonItineraryWorkbook,
} from '../engines/timecard/ingestion/amazonItinerary';
import {
  parseBreakReport,
  parseBreakReportCsv,
} from '../engines/timecard/ingestion/breakReport';
import { UploadFileDto } from './dto/upload-file.dto';

const DOC_TYPES_WITH_A_DATE: UploadDocType[] = [
  UploadDocType.AMAZON_ACTIVITY,
  UploadDocType.AMAZON_BREAK,
];

interface ParsedUpload {
  parsedData: Prisma.InputJsonValue | null;
  date: string | null;
}

async function parseUploadedFile(
  docType: UploadDocType,
  buffer: Buffer,
  suppliedDate: string | undefined,
): Promise<ParsedUpload> {
  switch (docType) {
    case UploadDocType.PAYROLL_TIMECARD: {
      const rawRows = await parsePayrollExportWorkbook(buffer);
      const parsedData = groupPayrollExport(rawRows);
      return {
        parsedData: parsedData as unknown as Prisma.InputJsonValue,
        date: null,
      };
    }
    case UploadDocType.AMAZON_ACTIVITY: {
      const rawRows = await parseAmazonItineraryWorkbook(buffer);
      const parsedData = parseAmazonItinerary(rawRows, suppliedDate!);
      return {
        parsedData: parsedData as unknown as Prisma.InputJsonValue,
        date: suppliedDate!,
      };
    }
    case UploadDocType.AMAZON_BREAK: {
      const { rows: rawRows, date } = parseBreakReportCsv(buffer);
      if (date === null) {
        throw new BadRequestException(
          'Could not detect a Date: line in the Amazon Break Report file metadata',
        );
      }
      const parsedData = parseBreakReport(rawRows, date);
      return {
        parsedData: parsedData as unknown as Prisma.InputJsonValue,
        date,
      };
    }
    default:
      return { parsedData: null, date: null };
  }
}

interface UploadedDocumentLike {
  id: string;
  jobId: string;
  docType: UploadDocType;
  fileName: string;
  checksum: string;
  version: number;
  date: Date | null;
  parsedData: Prisma.JsonValue;
  uploadedById: string;
  uploadedAt: Date;
  status: string;
}

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(
    jobId: string,
    dto: UploadFileDto,
    file: Express.Multer.File,
    userId: string,
    orgId: string,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const job = await this.prisma.job.findFirst({
      where: { id: jobId, orgId },
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    if (dto.docType === UploadDocType.AMAZON_ACTIVITY && !dto.date) {
      throw new BadRequestException(
        'date is required for AMAZON_ACTIVITY uploads (the Amazon Itinerary file has no date column)',
      );
    }

    const checksum = sha256Checksum(file.buffer);

    const existing = await this.prisma.uploadedDocument.findUnique({
      where: {
        jobId_docType_checksum: { jobId, docType: dto.docType, checksum },
      },
    });
    if (existing) {
      return this.toResponse(existing);
    }

    let parsed: ParsedUpload;
    try {
      parsed = await parseUploadedFile(dto.docType, file.buffer, dto.date);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new BadRequestException(
        `Failed to parse ${dto.docType} file: ${message}`,
      );
    }

    const versionKey: Prisma.UploadedDocumentWhereInput =
      DOC_TYPES_WITH_A_DATE.includes(dto.docType)
        ? { jobId, docType: dto.docType, date: new Date(parsed.date!) }
        : { jobId, docType: dto.docType };

    const latest = await this.prisma.uploadedDocument.findFirst({
      where: versionKey,
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.uploadedDocument.create({
        data: {
          jobId,
          docType: dto.docType,
          fileName: file.originalname,
          checksum,
          version,
          date: parsed.date ? new Date(parsed.date) : null,
          fileContent: file.buffer as unknown as Uint8Array<ArrayBuffer>,
          parsedData: parsed.parsedData ?? Prisma.DbNull,
          uploadedById: userId,
        },
      });

      await tx.auditEntry.create({
        data: {
          jobId,
          userId,
          action: 'UPLOAD',
          detail: `Uploaded ${dto.docType} (${file.originalname}), version ${version}`,
        },
      });

      return doc;
    });

    return this.toResponse(created);
  }

  async findAll(jobId: string, orgId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, orgId },
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const docs = await this.prisma.uploadedDocument.findMany({
      where: { jobId },
      orderBy: { uploadedAt: 'desc' },
    });
    return docs.map((doc) => this.toResponse(doc));
  }

  private toResponse(doc: UploadedDocumentLike) {
    const rowCount = Array.isArray(doc.parsedData)
      ? doc.parsedData.length
      : null;
    return {
      id: doc.id,
      jobId: doc.jobId,
      docType: doc.docType,
      fileName: doc.fileName,
      checksum: doc.checksum,
      version: doc.version,
      date: doc.date,
      rowCount,
      uploadedById: doc.uploadedById,
      uploadedAt: doc.uploadedAt,
      status: doc.status,
    };
  }
}

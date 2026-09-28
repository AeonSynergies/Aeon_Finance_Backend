import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, DateApprovalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RejectDateDto } from './dto/reject-date.dto';
import { SubmitBlockedException } from './submit-blocked.exception';

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 404 unless the job exists in the caller's organization. */
  private async ensureJobExists(jobId: string, orgId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, orgId },
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
  }

  async findAllDates(jobId: string, orgId: string) {
    await this.ensureJobExists(jobId, orgId);

    return this.prisma.dateApproval.findMany({
      where: { jobId },
      orderBy: { date: 'asc' },
    });
  }

  async submit(jobId: string, date: string, userId: string, orgId: string) {
    await this.ensureJobExists(jobId, orgId);
    const parsedDate = new Date(date);

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.timecardRow.findMany({
        where: { jobId, date: parsedDate },
      });

      if (rows.length === 0) {
        throw new BadRequestException(
          `No rows found for job ${jobId} on ${date}`,
        );
      }

      const blockingRows = rows
        .filter(
          (row) =>
            row.validationStatus !== 'GOOD_NO_ERROR' && !row.overriddenAt,
        )
        .map((row) => ({ id: row.id, validationStatus: row.validationStatus }));

      if (blockingRows.length > 0) {
        throw new SubmitBlockedException(blockingRows);
      }

      const existing = await tx.dateApproval.findUnique({
        where: { jobId_date: { jobId, date: parsedDate } },
      });

      if (existing && existing.status !== DateApprovalStatus.IN_PROGRESS) {
        throw new ConflictException(
          `Date ${date} is already ${existing.status.toLowerCase()}`,
        );
      }

      const dateApproval = await tx.dateApproval.upsert({
        where: { jobId_date: { jobId, date: parsedDate } },
        create: {
          jobId,
          date: parsedDate,
          status: DateApprovalStatus.SENT_FOR_APPROVAL,
          submittedById: userId,
          submittedAt: new Date(),
        },
        update: {
          status: DateApprovalStatus.SENT_FOR_APPROVAL,
          submittedById: userId,
          submittedAt: new Date(),
        },
      });

      await tx.auditEntry.create({
        data: {
          jobId,
          userId,
          action: 'SUBMIT',
          detail: `Date ${date} submitted for approval (${rows.length} row(s))`,
        },
      });

      return dateApproval;
    });
  }

  async approve(jobId: string, date: string, userId: string, orgId: string) {
    await this.ensureJobExists(jobId, orgId);
    const parsedDate = new Date(date);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dateApproval.findUnique({
        where: { jobId_date: { jobId, date: parsedDate } },
      });

      if (
        !existing ||
        existing.status !== DateApprovalStatus.SENT_FOR_APPROVAL
      ) {
        throw new ConflictException(
          `Date ${date} has not been submitted for approval`,
        );
      }

      const dateApproval = await tx.dateApproval.update({
        where: { jobId_date: { jobId, date: parsedDate } },
        data: {
          status: DateApprovalStatus.APPROVED,
          decidedById: userId,
          decidedAt: new Date(),
        },
      });

      await tx.timecardRow.updateMany({
        where: { jobId, date: parsedDate },
        data: { approvalStatus: ApprovalStatus.APPROVED },
      });

      await tx.auditEntry.create({
        data: {
          jobId,
          userId,
          action: 'APPROVE',
          detail: `Date ${date} approved`,
        },
      });

      return dateApproval;
    });
  }

  async reject(
    jobId: string,
    date: string,
    dto: RejectDateDto,
    userId: string,
    orgId: string,
  ) {
    await this.ensureJobExists(jobId, orgId);
    const parsedDate = new Date(date);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.dateApproval.findUnique({
        where: { jobId_date: { jobId, date: parsedDate } },
      });

      if (
        !existing ||
        existing.status !== DateApprovalStatus.SENT_FOR_APPROVAL
      ) {
        throw new ConflictException(
          `Date ${date} has not been submitted for approval`,
        );
      }

      const dateApproval = await tx.dateApproval.update({
        where: { jobId_date: { jobId, date: parsedDate } },
        data: {
          status: DateApprovalStatus.IN_PROGRESS,
          decidedById: userId,
          decidedAt: new Date(),
          rejectionComments: dto.rejectionComments,
        },
      });

      await tx.timecardRow.updateMany({
        where: { jobId, date: parsedDate },
        data: { approvalStatus: ApprovalStatus.PENDING },
      });

      await tx.auditEntry.create({
        data: {
          jobId,
          userId,
          action: 'REJECT',
          detail: `Date ${date} rejected: ${dto.rejectionComments}`,
        },
      });

      return dateApproval;
    });
  }
}

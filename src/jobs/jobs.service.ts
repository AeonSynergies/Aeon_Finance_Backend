import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { generateJobId } from './job-id';
import { computeJobStatus, JobStatus } from './job-status';

const dateApprovalsForStatus = {
  select: { status: true, date: true },
} as const;

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateJobDto, createdById: string, orgId: string) {
    const periodStart = new Date(dto.periodStart);
    const jobId = generateJobId(dto.frequency, periodStart);

    try {
      const job = await this.prisma.job.create({
        data: {
          orgId,
          jobId,
          frequency: dto.frequency,
          periodStart,
          periodEnd: new Date(dto.periodEnd),
          processDate: new Date(dto.processDate),
          createdById,
        },
      });

      return { ...job, status: JobStatus.DRAFT_INPROGRESS };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `A job with jobId "${jobId}" already exists`,
        );
      }
      throw err;
    }
  }

  async findOne(id: string, orgId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, orgId },
      include: { dateApprovals: dateApprovalsForStatus },
    });

    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    return this.withComputedStatus(job);
  }

  async findAll(orgId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: { dateApprovals: dateApprovalsForStatus },
    });

    return jobs.map((job) => this.withComputedStatus(job));
  }

  async lock(id: string, userId: string, orgId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, orgId },
      include: { dateApprovals: dateApprovalsForStatus },
    });

    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    if (job.lockedAt) {
      throw new ConflictException(`Job ${id} is already locked`);
    }

    const { dateApprovals, ...jobFields } = job;
    const currentStatus = computeJobStatus({
      periodStart: job.periodStart,
      periodEnd: job.periodEnd,
      lockedAt: job.lockedAt,
      dateApprovals,
    });

    if (currentStatus !== JobStatus.APPROVED) {
      throw new ConflictException(
        `Job ${id} cannot be locked until every date in the period is approved (current status: ${currentStatus})`,
      );
    }

    const updated = await this.prisma.job.update({
      where: { id },
      data: { lockedAt: new Date() },
    });

    await this.prisma.auditEntry.create({
      data: {
        jobId: id,
        userId,
        action: 'LOCK',
        detail: `Job ${jobFields.jobId} locked`,
      },
    });

    return this.withComputedStatus({ ...updated, dateApprovals });
  }

  private withComputedStatus<
    T extends {
      periodStart: Date;
      periodEnd: Date;
      lockedAt: Date | null;
      dateApprovals: { status: string; date: Date }[];
    },
  >(job: T) {
    const { dateApprovals, ...jobFields } = job;
    return {
      ...jobFields,
      status: computeJobStatus({
        periodStart: job.periodStart,
        periodEnd: job.periodEnd,
        lockedAt: job.lockedAt,
        dateApprovals,
      }),
    };
  }
}

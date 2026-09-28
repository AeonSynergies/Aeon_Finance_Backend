import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(jobId: string, orgId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, orgId },
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return this.prisma.auditEntry.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

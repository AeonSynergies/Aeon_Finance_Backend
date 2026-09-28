import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { TimecardThresholds } from '../engines/timecard/types';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** One settings row per organization, created with the schema defaults on first read. */
  async getOrCreate(orgId: string) {
    return this.prisma.settings.upsert({
      where: { orgId },
      create: { orgId },
      update: {},
    });
  }

  async update(orgId: string, dto: UpdateSettingsDto) {
    await this.getOrCreate(orgId);
    return this.prisma.settings.update({
      where: { orgId },
      data: dto,
    });
  }

  async getThresholds(orgId: string): Promise<TimecardThresholds> {
    const settings = await this.getOrCreate(orgId);
    return {
      waveLoginBufferMins: settings.waveLoginBufferMins,
      amazonLoginBufferMins: settings.amazonLoginBufferMins,
      physicalLoginBufferMins: settings.physicalLoginBufferMins,
      mealBreakBufferMins: settings.mealBreakBufferMins,
      logoutBufferMins: settings.logoutBufferMins,
      amazonAutoLogoutEstimateBufferMins:
        settings.amazonAutoLogoutEstimateBufferMins,
      ptoEarnCodes: settings.ptoEarnCodes,
      bonusEarnCodes: settings.bonusEarnCodes,
      trainingEarnCodes: settings.trainingEarnCodes,
      vtoEarnCodes: settings.vtoEarnCodes,
      fuzzyAmazonMatchThreshold: settings.fuzzyAmazonMatchThreshold,
      fuzzyBreakReportMatchThreshold: settings.fuzzyBreakReportMatchThreshold,
      mealWaiverExemptStates: settings.mealWaiverExemptStates,
    };
  }
}

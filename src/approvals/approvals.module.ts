import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { DatesController } from './dates.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  controllers: [ApprovalsController, DatesController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}

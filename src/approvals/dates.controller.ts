import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApprovalsService } from './approvals.service';

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('jobs/:id/dates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DatesController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  @RequirePermission('APPROVALS', 'read')
  @ApiOperation({
    summary:
      "List a Job's DateApproval rows, chronological -- only includes dates submitted at least once, not every calendar date in the period",
  })
  findAll(@Param('id') jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.approvalsService.findAllDates(jobId, user.orgId);
  }
}

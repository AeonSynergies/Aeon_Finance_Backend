import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RejectDateDto } from './dto/reject-date.dto';
import { ApprovalsService } from './approvals.service';

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('jobs/:id/dates/:date')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post('submit')
  @RequirePermission('APPROVALS', 'write')
  @ApiOperation({
    summary:
      "Submit a date for approval; blocked (409) if any of that date's rows are unresolved",
  })
  submit(
    @Param('id') jobId: string,
    @Param('date') date: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalsService.submit(jobId, date, user.userId, user.orgId);
  }

  @Post('approve')
  @RequirePermission('APPROVALS', 'edit')
  @ApiOperation({ summary: 'Approve a submitted date' })
  approve(
    @Param('id') jobId: string,
    @Param('date') date: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalsService.approve(jobId, date, user.userId, user.orgId);
  }

  @Post('reject')
  @RequirePermission('APPROVALS', 'edit')
  @ApiOperation({
    summary: 'Reject a submitted date, sending it back to the Executive',
  })
  reject(
    @Param('id') jobId: string,
    @Param('date') date: string,
    @Body() dto: RejectDateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalsService.reject(
      jobId,
      date,
      dto,
      user.userId,
      user.orgId,
    );
  }
}

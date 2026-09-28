import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('jobs/:id')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('audit')
  @RequirePermission('AUDIT', 'read')
  @ApiOperation({
    summary: "List a Job's audit trail, most recent first",
  })
  findAll(@Param('id') jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.auditService.findAll(jobId, user.orgId);
  }
}

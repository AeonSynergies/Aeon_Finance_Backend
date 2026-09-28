import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateJobDto } from './dto/create-job.dto';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @RequirePermission('JOBS', 'write')
  @ApiOperation({ summary: 'Create a new payroll Job for a period' })
  create(@Body() dto: CreateJobDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.create(dto, user.userId, user.orgId);
  }

  @Get()
  @RequirePermission('JOBS', 'read')
  @ApiOperation({
    summary:
      "List the organization's Jobs, most recently created first, each with computed status",
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.findAll(user.orgId);
  }

  @Get(':id')
  @RequirePermission('JOBS', 'read')
  @ApiOperation({ summary: "Get a Job's details, including computed status" })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.findOne(id, user.orgId);
  }

  @Post(':id/lock')
  @RequirePermission('JOBS', 'edit')
  @ApiOperation({
    summary:
      'Lock a Job once every date in its period is approved (one-way action)',
  })
  lock(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.lock(id, user.userId, user.orgId);
  }
}

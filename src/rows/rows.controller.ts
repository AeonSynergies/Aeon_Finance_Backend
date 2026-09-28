import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { OverrideRowDto } from './dto/override-row.dto';
import { RowsService } from './rows.service';

@ApiTags('rows')
@ApiBearerAuth()
@Controller('jobs/:id')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RowsController {
  constructor(private readonly rowsService: RowsService) {}

  @Post('validate')
  @RequirePermission('VALIDATION', 'write')
  @ApiOperation({
    summary:
      "Run the Timecard engine over the job's latest uploaded documents and persist results",
  })
  validate(@Param('id') jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rowsService.validateAndPersist(jobId, user.orgId);
  }

  @Get('rows')
  @RequirePermission('VALIDATION', 'read')
  @ApiOperation({
    summary:
      "List a Job's validated rows, optionally filtered by date and/or status",
  })
  @ApiQuery({
    name: 'date',
    required: false,
    example: '2026-11-02',
    description: 'ISO date string. Omit to list all dates for the job.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    example: 'GOOD_NO_ERROR',
    description: 'A validationStatus value. Omit to list all statuses.',
  })
  findAll(
    @Param('id') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    return this.rowsService.findAll(jobId, user.orgId, date, status);
  }

  @Patch('rows/:rowId/override')
  @RequirePermission('VALIDATION', 'edit')
  @ApiOperation({
    summary: "Override a row's validation status with a mandatory reason",
  })
  override(
    @Param('id') jobId: string,
    @Param('rowId') rowId: string,
    @Body() dto: OverrideRowDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rowsService.override(
      jobId,
      rowId,
      dto,
      user.userId,
      user.orgId,
    );
  }
}

import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermission('SETTINGS', 'read')
  @ApiOperation({ summary: "Read the organization's engine thresholds" })
  findOne(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getOrCreate(user.orgId);
  }

  @Patch()
  @RequirePermission('SETTINGS', 'edit')
  @ApiOperation({ summary: 'Update one or more engine thresholds' })
  update(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.update(user.orgId, dto);
  }
}

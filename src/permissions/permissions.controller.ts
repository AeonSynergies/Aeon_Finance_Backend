import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PERMISSION_ACTIONS, PERMISSION_CATALOG } from './permissions.catalog';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  @Get('modules')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Permission catalog: modules and what Read / Write / Edit allow in each',
  })
  modules() {
    return PERMISSION_CATALOG.map((d) => ({
      ...d,
      actions: PERMISSION_ACTIONS.map((action) => ({
        action,
        applicable: !!d.actions[action],
        description: d.actions[action] ?? null,
      })),
    }));
  }
}

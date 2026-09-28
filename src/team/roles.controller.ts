import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('team')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission('TEAM', 'read')
  @ApiOperation({
    summary:
      "The organization's roles with their permissions and member counts",
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.roles.findAll(user.orgId);
  }

  @Post()
  @RequirePermission('TEAM', 'write')
  @ApiOperation({
    summary: 'Create a role (you can only grant permissions you hold)',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.roles.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('TEAM', 'edit')
  @ApiOperation({
    summary:
      "Rename a role or change its permissions (not system roles or your own role's permissions)",
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roles.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('TEAM', 'edit')
  @ApiOperation({ summary: 'Delete a role that has no members' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.roles.remove(user, id);
  }
}

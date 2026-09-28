import {
  Body,
  Controller,
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
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';
import { MembersService } from './members.service';

@ApiTags('team')
@ApiBearerAuth()
@Controller('team/members')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermission('TEAM', 'read')
  @ApiOperation({ summary: "The organization's members and their roles" })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.members.findAll(user.orgId);
  }

  @Post()
  @RequirePermission('TEAM', 'write')
  @ApiOperation({ summary: 'Add a member with an initial password and a role' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMemberDto) {
    return this.members.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('TEAM', 'edit')
  @ApiOperation({ summary: "Change a member's name, role or active status" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(user, id, dto);
  }
}

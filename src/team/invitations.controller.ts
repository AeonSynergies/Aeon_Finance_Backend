import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('team')
@ApiBearerAuth()
@Controller('team/invitations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TeamInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @RequirePermission('TEAM', 'read')
  @ApiOperation({
    summary: 'Pending invitations (including expired ones that can be resent)',
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.invitations.findAll(user.orgId);
  }

  @Post()
  @RequirePermission('TEAM', 'write')
  @ApiOperation({
    summary:
      'Invite someone with a role; returns the one-time token for the invite link (re-inviting replaces the old link)',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitations.create(user, dto);
  }

  @Delete(':id')
  @RequirePermission('TEAM', 'edit')
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invitations.revoke(user, id);
  }
}

/** Unauthenticated: the invitee opens the link before they have an account. */
@ApiTags('team')
@Controller('invitations')
export class PublicInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':token')
  @ApiOperation({
    summary:
      'Invite details for the accept page (404 invalid/used, 410 expired)',
  })
  preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept: set name + password, create the account and sign in',
  })
  accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    return this.invitations.accept(token, dto);
  }
}

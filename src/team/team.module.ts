import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationsService } from './invitations.service';
import {
  PublicInvitationsController,
  TeamInvitationsController,
} from './invitations.controller';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [AuthModule],
  controllers: [
    RolesController,
    MembersController,
    TeamInvitationsController,
    PublicInvitationsController,
  ],
  providers: [RolesService, MembersService, InvitationsService],
})
export class TeamModule {}

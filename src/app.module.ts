import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JobsModule } from './jobs/jobs.module';
import { RowsModule } from './rows/rows.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { AuditModule } from './audit/audit.module';
import { SettingsModule } from './settings/settings.module';
import { UploadsModule } from './uploads/uploads.module';
import { PermissionsModule } from './permissions/permissions.module';
import { TeamModule } from './team/team.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    JobsModule,
    UploadsModule,
    RowsModule,
    ApprovalsModule,
    AuditModule,
    SettingsModule,
    PermissionsModule,
    TeamModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

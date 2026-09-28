import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { RowsController } from './rows.controller';
import { RowsService } from './rows.service';

@Module({
  imports: [SettingsModule],
  controllers: [RowsController],
  providers: [RowsService],
})
export class RowsModule {}

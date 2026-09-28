import { Global, Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  controllers: [PermissionsController],
  providers: [PermissionsGuard],
  exports: [PermissionsGuard],
})
export class PermissionsModule {}

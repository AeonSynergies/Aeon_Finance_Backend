import { SetMetadata } from '@nestjs/common';
import type { PermissionModule } from '@prisma/client';
import type { PermissionAction } from './permissions.catalog';

export const PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  module: PermissionModule;
  action: PermissionAction;
}

/** Route requires the caller's role to grant `action` on `module`. Use with JwtAuthGuard + PermissionsGuard. */
export const RequirePermission = (
  module: PermissionModule,
  action: PermissionAction,
) =>
  SetMetadata(PERMISSION_KEY, { module, action } satisfies RequiredPermission);

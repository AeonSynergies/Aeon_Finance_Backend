import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PERMISSION_CATALOG } from './permissions.catalog';
import {
  PERMISSION_KEY,
  type RequiredPermission,
} from './require-permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      RequiredPermission | undefined
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (user?.permissions[required.module]?.[required.action]) return true;

    const label =
      PERMISSION_CATALOG.find((d) => d.module === required.module)?.label ??
      required.module;
    throw new ForbiddenException({
      message: `Your role doesn't allow ${required.action} access to ${label}`,
      requiredPermission: required,
    });
  }
}

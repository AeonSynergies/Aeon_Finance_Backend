import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  emptyPermissionMap,
  fullPermissionMap,
  missingGrants,
  normalizePermission,
  toPermissionMap,
} from './permissions.catalog';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSION_KEY } from './require-permission.decorator';

describe('permissions catalog', () => {
  it('write / edit imply read, and non-applicable actions are dropped', () => {
    expect(normalizePermission('VALIDATION', { edit: true })).toEqual({
      read: true,
      write: false,
      edit: true,
    });
    expect(
      normalizePermission('AUDIT', { read: true, write: true, edit: true }),
    ).toEqual({ read: true, write: false, edit: false });
    expect(normalizePermission('SETTINGS', { write: true })).toEqual({
      read: false,
      write: false,
      edit: false,
    });
  });

  it('system roles get every applicable action regardless of stored rows', () => {
    expect(toPermissionMap([], true)).toEqual(fullPermissionMap());
    expect(fullPermissionMap().UPLOADS).toEqual({
      read: true,
      write: true,
      edit: false,
    });
  });

  it('reports grants the holder is missing', () => {
    const held = emptyPermissionMap();
    held.JOBS = { read: true, write: true, edit: false };
    const wanted = emptyPermissionMap();
    wanted.JOBS = { read: true, write: false, edit: true };
    expect(missingGrants(held, wanted)).toEqual(['Jobs: edit']);
  });
});

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());
  const ctx = (required: unknown, permissions = emptyPermissionMap()) =>
    ({
      getHandler: () => {
        const h = () => {};
        Reflect.defineMetadata(PERMISSION_KEY, required, h);
        return h;
      },
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
    }) as unknown as ExecutionContext;

  it('allows routes without a requirement', () => {
    expect(guard.canActivate(ctx(undefined))).toBe(true);
  });

  it('allows when the role grants the action and forbids otherwise', () => {
    const perms = emptyPermissionMap();
    perms.APPROVALS = { read: true, write: true, edit: false };
    expect(
      guard.canActivate(ctx({ module: 'APPROVALS', action: 'write' }, perms)),
    ).toBe(true);
    expect(() =>
      guard.canActivate(ctx({ module: 'APPROVALS', action: 'edit' }, perms)),
    ).toThrow(ForbiddenException);
  });
});

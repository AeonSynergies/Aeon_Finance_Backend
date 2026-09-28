import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  missingGrants,
  toPermissionMap,
  type PermissionMap,
} from '../permissions/permissions.catalog';

/**
 * Anti-escalation: a member can only grant, assign or manage permissions they
 * hold themselves. System-role members (the org's Admin) are unrestricted.
 */
export function assertWithinOwnPermissions(
  actor: AuthenticatedUser,
  wanted: PermissionMap,
  what: string,
) {
  if (actor.isSystemRole) return;
  const missing = missingGrants(actor.permissions, wanted);
  if (missing.length) {
    throw new ForbiddenException({
      message: `You can't ${what} with permissions you don't have yourself`,
      missingPermissions: missing,
    });
  }
}

/** A role in the actor's org whose permissions the actor may hand out (to a member or an invite). */
export async function findAssignableRole(
  prisma: Pick<PrismaClient, 'role'>,
  actor: AuthenticatedUser,
  roleId: string,
) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, orgId: actor.orgId },
    include: { permissions: true },
  });
  if (!role)
    throw new BadRequestException(
      'That role does not exist in your organization',
    );
  if (role.isSystem && !actor.isSystemRole) {
    throw new ForbiddenException(
      `Only an ${role.name} can assign the ${role.name} role`,
    );
  }
  assertWithinOwnPermissions(
    actor,
    toPermissionMap(role.permissions, role.isSystem),
    'assign a role',
  );
  return role;
}

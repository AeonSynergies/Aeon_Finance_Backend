import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  PERMISSION_CATALOG,
  emptyPermissionMap,
  normalizePermission,
  toPermissionMap,
  type PermissionMap,
} from '../permissions/permissions.catalog';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import type { PermissionInputDto } from './dto/permission-input.dto';
import { assertWithinOwnPermissions } from './team.policy';

const roleInclude = {
  permissions: true,
  _count: { select: { users: true } },
} as const;

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: typeof roleInclude;
}>;

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    const roles = await this.prisma.role.findMany({
      where: { orgId },
      include: roleInclude,
      orderBy: [{ isSystem: 'desc' }, { isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return roles.map(toResponse);
  }

  async create(actor: AuthenticatedUser, dto: CreateRoleDto) {
    const permissions = applyInputs(emptyPermissionMap(), dto.permissions);
    assertWithinOwnPermissions(actor, permissions, 'create a role');

    try {
      const role = await this.prisma.role.create({
        data: {
          orgId: actor.orgId,
          name: dto.name,
          description: dto.description || null,
          permissions: { create: toRows(permissions) },
        },
        include: roleInclude,
      });
      return toResponse(role);
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictException(
          `A role named "${dto.name}" already exists`,
        );
      throw e;
    }
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateRoleDto) {
    const role = await this.getManageable(actor, id, 'change');

    if (dto.permissions && role.id === actor.roleId) {
      throw new ForbiddenException(
        "You can't change the permissions of your own role",
      );
    }

    const next = applyInputs(
      toPermissionMap(role.permissions),
      dto.permissions,
    );
    assertWithinOwnPermissions(actor, next, 'give a role');

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.role.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.description !== undefined
              ? { description: dto.description || null }
              : {}),
          },
        });
        if (dto.permissions) {
          for (const row of toRows(next)) {
            await tx.rolePermission.upsert({
              where: { roleId_module: { roleId: id, module: row.module } },
              create: { roleId: id, ...row },
              update: row,
            });
          }
        }
        return tx.role.findUniqueOrThrow({
          where: { id },
          include: roleInclude,
        });
      });
      return toResponse(updated);
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictException(
          `A role named "${dto.name}" already exists`,
        );
      throw e;
    }
  }

  async remove(actor: AuthenticatedUser, id: string) {
    const role = await this.getManageable(actor, id, 'delete');
    const pendingInvites = await this.prisma.invitation.count({
      where: {
        roleId: id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (pendingInvites > 0) {
      throw new ConflictException({
        message: `"${role.name}" has ${pendingInvites} pending invitation(s). Revoke them first.`,
        pendingInvitations: pendingInvites,
      });
    }
    if (role._count.users > 0) {
      throw new ConflictException({
        message: `"${role.name}" is assigned to ${role._count.users} member(s). Move them to another role first.`,
        memberCount: role._count.users,
      });
    }
    await this.prisma.role.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Loads a role in the actor's org that the actor is allowed to modify. */
  private async getManageable(
    actor: AuthenticatedUser,
    id: string,
    verb: string,
  ): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findFirst({
      where: { id, orgId: actor.orgId },
      include: roleInclude,
    });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    if (role.isSystem)
      throw new ForbiddenException(
        `The ${role.name} role is built in and can't be ${verb === 'delete' ? 'deleted' : 'changed'}`,
      );
    assertWithinOwnPermissions(
      actor,
      toPermissionMap(role.permissions),
      `${verb} a role`,
    );
    return role;
  }
}

function applyInputs(
  base: PermissionMap,
  inputs: PermissionInputDto[] | undefined,
): PermissionMap {
  const map = { ...base };
  for (const p of inputs ?? [])
    map[p.module] = normalizePermission(p.module, p);
  return map;
}

function toRows(map: PermissionMap) {
  return PERMISSION_CATALOG.map((d) => ({
    module: d.module,
    canRead: map[d.module].read,
    canWrite: map[d.module].write,
    canEdit: map[d.module].edit,
  }));
}

function toResponse(role: RoleWithPermissions) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isDefault: role.isDefault,
    memberCount: role._count.users,
    permissions: toPermissionMap(role.permissions, role.isSystem),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

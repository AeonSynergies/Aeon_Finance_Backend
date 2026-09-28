import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { toPermissionMap } from '../permissions/permissions.catalog';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';
import { assertWithinOwnPermissions, findAssignableRole } from './team.policy';

const memberSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  role: { select: { id: true, name: true, isSystem: true } },
} as const;

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId },
      select: memberSelect,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async create(actor: AuthenticatedUser, dto: CreateMemberDto) {
    await findAssignableRole(this.prisma, actor, dto.roleId);
    try {
      return await this.prisma.user.create({
        data: {
          orgId: actor.orgId,
          roleId: dto.roleId,
          name: dto.name,
          email: dto.email,
          passwordHash: await bcrypt.hash(dto.password, 10),
        },
        select: memberSelect,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('That email is already in use');
      }
      throw e;
    }
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateMemberDto) {
    const member = await this.prisma.user.findFirst({
      where: { id, orgId: actor.orgId },
      include: { role: { include: { permissions: true } } },
    });
    if (!member) throw new NotFoundException(`Member ${id} not found`);

    const changesRole =
      dto.roleId !== undefined && dto.roleId !== member.roleId;
    const deactivates = dto.isActive === false && member.isActive;

    if (member.id === actor.userId && (changesRole || deactivates)) {
      throw new ForbiddenException(
        "You can't change your own role or deactivate yourself",
      );
    }
    // Can't manage someone whose access goes beyond your own.
    if (member.role.isSystem && !actor.isSystemRole) {
      throw new ForbiddenException(
        `Only an ${member.role.name} can change another ${member.role.name}`,
      );
    }
    assertWithinOwnPermissions(
      actor,
      toPermissionMap(member.role.permissions),
      'manage a member',
    );
    if (changesRole) await findAssignableRole(this.prisma, actor, dto.roleId!);

    // The organization must always keep at least one active system-role member.
    if (
      member.role.isSystem &&
      member.isActive &&
      (deactivates || changesRole)
    ) {
      const otherAdmins = await this.prisma.user.count({
        where: {
          orgId: actor.orgId,
          isActive: true,
          role: { isSystem: true },
          id: { not: member.id },
        },
      });
      if (otherAdmins === 0) {
        throw new ConflictException(
          `The organization needs at least one active ${member.role.name}`,
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: memberSelect,
    });
  }
}

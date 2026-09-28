import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { createTestOrg, deleteTestOrg } from '../test-utils/test-org';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  emptyPermissionMap,
  fullPermissionMap,
} from '../permissions/permissions.catalog';
import { MembersService } from './members.service';
import { RolesService } from './roles.service';

describe('Team roles & members (integration, real database)', () => {
  let prisma: PrismaService;
  let roles: RolesService;
  let members: MembersService;
  let org: Awaited<ReturnType<typeof createTestOrg>>;
  let other: Awaited<ReturnType<typeof createTestOrg>>;
  let admin: AuthenticatedUser;
  let lead: AuthenticatedUser; // TEAM read/write/edit + JOBS read only
  const email = (tag: string) =>
    `team-spec-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@aeon.test`;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, RolesService, MembersService],
    }).compile();
    prisma = module.get(PrismaService);
    roles = module.get(RolesService);
    members = module.get(MembersService);
    await prisma.$connect();
    org = await createTestOrg(prisma);
    other = await createTestOrg(prisma);

    const adminUser = await prisma.user.create({
      data: {
        email: email('admin'),
        name: 'Admin',
        passwordHash: 'x',
        orgId: org.orgId,
        roleId: org.roleIds.admin,
      },
    });
    admin = {
      userId: adminUser.id,
      orgId: org.orgId,
      roleId: org.roleIds.admin,
      roleName: 'Admin',
      isSystemRole: true,
      permissions: fullPermissionMap(),
    };

    const leadPerms = emptyPermissionMap();
    leadPerms.TEAM = { read: true, write: true, edit: true };
    leadPerms.JOBS = { read: true, write: false, edit: false };
    const leadRole = await roles.create(admin, {
      name: 'Team Lead',
      permissions: [
        { module: 'TEAM', read: true, write: true, edit: true },
        { module: 'JOBS', read: true },
      ],
    });
    const leadUser = await prisma.user.create({
      data: {
        email: email('lead'),
        name: 'Lead',
        passwordHash: 'x',
        orgId: org.orgId,
        roleId: leadRole.id,
      },
    });
    lead = {
      userId: leadUser.id,
      orgId: org.orgId,
      roleId: leadRole.id,
      roleName: 'Team Lead',
      isSystemRole: false,
      permissions: leadPerms,
    };
  });

  afterAll(async () => {
    await deleteTestOrg(prisma, org.orgId);
    await deleteTestOrg(prisma, other.orgId);
    await prisma.$disconnect();
  });

  describe('roles', () => {
    it('creates a role with normalized permissions (edit implies read)', async () => {
      const role = await roles.create(admin, {
        name: 'Reviewer',
        permissions: [{ module: 'VALIDATION', edit: true }],
      });
      expect(role.permissions.VALIDATION).toEqual({
        read: true,
        write: false,
        edit: true,
      });
      expect(role.permissions.SETTINGS).toEqual({
        read: false,
        write: false,
        edit: false,
      });
      expect(role.memberCount).toBe(0);
    });

    it('rejects duplicate names within an org but allows them across orgs', async () => {
      await expect(roles.create(admin, { name: 'Reviewer' })).rejects.toThrow(
        ConflictException,
      );
      const otherAdmin = { ...admin, orgId: other.orgId };
      await expect(
        roles.create(otherAdmin, { name: 'Reviewer' }),
      ).resolves.toMatchObject({ name: 'Reviewer' });
    });

    it('blocks privilege escalation: a lead cannot grant what they lack', async () => {
      await expect(
        roles.create(lead, {
          name: 'Sneaky',
          permissions: [{ module: 'SETTINGS', edit: true }],
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        roles.create(lead, {
          name: 'Viewer',
          permissions: [{ module: 'JOBS', read: true }],
        }),
      ).resolves.toMatchObject({ name: 'Viewer' });
    });

    it('protects system roles and your own role', async () => {
      await expect(
        roles.update(admin, org.roleIds.admin, { name: 'Boss' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(roles.remove(admin, org.roleIds.admin)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        roles.update(lead, lead.roleId, {
          permissions: [{ module: 'TEAM', read: true }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('a lead cannot modify a role that has more access than they do', async () => {
      await expect(
        roles.update(lead, org.roleIds.executive, { description: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates permissions per module and leaves others untouched', async () => {
      const role = await roles.create(admin, {
        name: 'Partial',
        permissions: [{ module: 'JOBS', read: true }],
      });
      const updated = await roles.update(admin, role.id, {
        permissions: [{ module: 'AUDIT', read: true }],
      });
      expect(updated.permissions.JOBS.read).toBe(true);
      expect(updated.permissions.AUDIT.read).toBe(true);
    });

    it('refuses to delete a role that still has members; deletes an empty one', async () => {
      await expect(roles.remove(admin, lead.roleId)).rejects.toThrow(
        ConflictException,
      );
      const empty = await roles.create(admin, { name: 'Temp' });
      await expect(roles.remove(admin, empty.id)).resolves.toEqual({
        id: empty.id,
        deleted: true,
      });
    });

    it('treats roles from another org as not found', async () => {
      await expect(
        roles.update(admin, other.roleIds.manager, { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('members', () => {
    it('adds a member; duplicate email → 409; foreign role → 400', async () => {
      const e = email('m1');
      const m = await members.create(admin, {
        name: 'M One',
        email: e,
        password: 'password123',
        roleId: org.roleIds.executive,
      });
      expect(m).toMatchObject({
        email: e,
        isActive: true,
        role: { name: 'Executive' },
      });
      expect(m).not.toHaveProperty('passwordHash');
      await expect(
        members.create(admin, {
          name: 'Dup',
          email: e,
          password: 'password123',
          roleId: org.roleIds.executive,
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        members.create(admin, {
          name: 'X',
          email: email('x'),
          password: 'password123',
          roleId: other.roleIds.executive,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('a lead cannot assign the Admin role or roles beyond their access', async () => {
      await expect(
        members.create(lead, {
          name: 'X',
          email: email('y'),
          password: 'password123',
          roleId: org.roleIds.admin,
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        members.create(lead, {
          name: 'X',
          email: email('z'),
          password: 'password123',
          roleId: org.roleIds.executive,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("can't change your own role or deactivate yourself", async () => {
      await expect(
        members.update(admin, admin.userId, { isActive: false }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        members.update(admin, admin.userId, { roleId: org.roleIds.manager }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        members.update(admin, admin.userId, { name: 'Renamed Admin' }),
      ).resolves.toMatchObject({ name: 'Renamed Admin' });
    });

    it('always keeps one active Admin', async () => {
      const second = await members.create(admin, {
        name: 'Admin Two',
        email: email('a2'),
        password: 'password123',
        roleId: org.roleIds.admin,
      });
      const secondActor = { ...admin, userId: second.id };
      // Two admins: demoting the first is fine…
      await members.update(secondActor, admin.userId, {
        roleId: org.roleIds.manager,
      });
      // …but the last remaining admin can't be removed by anyone.
      await expect(
        members.update(admin, second.id, { isActive: false }),
      ).rejects.toThrow(ConflictException);
    });

    it('treats members of another org as not found', async () => {
      const foreign = await prisma.user.create({
        data: {
          email: email('foreign'),
          name: 'F',
          passwordHash: 'x',
          orgId: other.orgId,
          roleId: other.roleIds.executive,
        },
      });
      await expect(
        members.update(admin, foreign.id, { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(
        (await members.findAll(org.orgId)).some((m) => m.id === foreign.id),
      ).toBe(false);
    });
  });
});

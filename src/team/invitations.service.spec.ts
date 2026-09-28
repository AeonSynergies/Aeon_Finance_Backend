import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  emptyPermissionMap,
  fullPermissionMap,
} from '../permissions/permissions.catalog';
import { PrismaService } from '../prisma/prisma.service';
import { createTestOrg, deleteTestOrg } from '../test-utils/test-org';
import { InvitationsService } from './invitations.service';
import { RolesService } from './roles.service';

describe('InvitationsService (integration, real database)', () => {
  let prisma: PrismaService;
  let invitations: InvitationsService;
  let roles: RolesService;
  let org: Awaited<ReturnType<typeof createTestOrg>>;
  let admin: AuthenticatedUser;
  const email = (tag: string) =>
    `invite-spec-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@aeon.test`;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [PrismaService, InvitationsService, RolesService, AuthService],
    }).compile();
    prisma = module.get(PrismaService);
    invitations = module.get(InvitationsService);
    roles = module.get(RolesService);
    await prisma.$connect();
    org = await createTestOrg(prisma);
    const u = await prisma.user.create({
      data: {
        email: email('admin'),
        name: 'Admin',
        passwordHash: 'x',
        orgId: org.orgId,
        roleId: org.roleIds.admin,
      },
    });
    admin = {
      userId: u.id,
      orgId: org.orgId,
      roleId: org.roleIds.admin,
      roleName: 'Admin',
      isSystemRole: true,
      permissions: fullPermissionMap(),
    };
  });

  afterAll(async () => {
    await deleteTestOrg(prisma, org.orgId);
    await prisma.$disconnect();
  });

  it('invites, previews and accepts: the new member gets the role and a session; the link is single-use', async () => {
    const e = email('new');
    const inv = await invitations.create(admin, {
      email: e,
      name: 'New Person',
      roleId: org.roleIds.executive,
    });
    expect(inv.token).toHaveLength(43);
    expect(
      await prisma.invitation.count({ where: { tokenHash: inv.token } }),
    ).toBe(0); // only the hash is stored

    await expect(invitations.preview(inv.token)).resolves.toMatchObject({
      email: e,
      role: { name: 'Executive' },
    });

    const session = await invitations.accept(inv.token, {
      name: 'New Person',
      password: 'password123',
    });
    expect(session.accessToken).toBeTruthy();
    expect(session.user).toMatchObject({
      email: e,
      role: { name: 'Executive' },
      org: { id: org.orgId },
    });

    await expect(
      invitations.accept(inv.token, { name: 'Again', password: 'password123' }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      invitations.create(admin, { email: e, roleId: org.roleIds.executive }),
    ).rejects.toThrow(ConflictException);
  });

  it('re-inviting replaces the old link; revoking kills it', async () => {
    const e = email('re');
    const first = await invitations.create(admin, {
      email: e,
      roleId: org.roleIds.manager,
    });
    const second = await invitations.create(admin, {
      email: e,
      roleId: org.roleIds.manager,
    });
    await expect(invitations.preview(first.token)).rejects.toThrow(
      NotFoundException,
    );
    expect(
      (await invitations.findAll(org.orgId)).filter((i) => i.email === e),
    ).toHaveLength(1);
    await invitations.revoke(admin, second.id);
    await expect(invitations.preview(second.token)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('expired links return 410 and are listed as EXPIRED', async () => {
    const inv = await invitations.create(admin, {
      email: email('old'),
      roleId: org.roleIds.manager,
    });
    await prisma.invitation.update({
      where: { id: inv.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(invitations.preview(inv.token)).rejects.toThrow(GoneException);
    await expect(
      invitations.accept(inv.token, { name: 'Late', password: 'password123' }),
    ).rejects.toThrow(GoneException);
    expect(
      (await invitations.findAll(org.orgId)).find((i) => i.id === inv.id)
        ?.status,
    ).toBe('EXPIRED');
  });

  it('anti-escalation applies to invites; pending invites block deleting their role', async () => {
    const perms = emptyPermissionMap();
    perms.TEAM = { read: true, write: true, edit: true };
    const lead: AuthenticatedUser = {
      ...admin,
      isSystemRole: false,
      roleId: 'n/a',
      permissions: perms,
    };
    await expect(
      invitations.create(lead, {
        email: email('x'),
        roleId: org.roleIds.admin,
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      invitations.create(lead, {
        email: email('y'),
        roleId: org.roleIds.executive,
      }),
    ).rejects.toThrow(ForbiddenException);

    const role = await roles.create(admin, {
      name: `Invitee role ${Date.now()}`,
    });
    await invitations.create(admin, { email: email('z'), roleId: role.id });
    await expect(roles.remove(admin, role.id)).rejects.toThrow(
      ConflictException,
    );
  });
});

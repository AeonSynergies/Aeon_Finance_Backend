import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { toPermissionMap } from '../permissions/permissions.catalog';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
import { assertWithinOwnPermissions, findAssignableRole } from './team.policy';

export const INVITE_TTL_DAYS = 7;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const pendingWhere = { acceptedAt: null, revokedAt: null } as const;

const invitationSelect = {
  id: true,
  email: true,
  name: true,
  expiresAt: true,
  createdAt: true,
  role: { select: { id: true, name: true, isSystem: true } },
  invitedBy: { select: { id: true, name: true } },
} as const;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Invite someone to the org with a role. Re-inviting the same email replaces
   * the previous pending invite (acts as "resend"). The raw token is returned
   * only here — it's what goes into the invite link.
   */
  async create(actor: AuthenticatedUser, dto: CreateInvitationDto) {
    await findAssignableRole(this.prisma, actor, dto.roleId);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { orgId: true },
    });
    if (existingUser) {
      throw new ConflictException(
        existingUser.orgId === actor.orgId
          ? 'That person is already a member'
          : 'That email is already in use',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { orgId: actor.orgId, email: dto.email, ...pendingWhere },
        data: { revokedAt: new Date() },
      });
      return tx.invitation.create({
        data: {
          orgId: actor.orgId,
          email: dto.email,
          name: dto.name || null,
          roleId: dto.roleId,
          invitedById: actor.userId,
          tokenHash: hashToken(token),
          expiresAt,
        },
        select: invitationSelect,
      });
    });

    return { ...toListItem(invitation), token };
  }

  /** Pending (not accepted / revoked) invitations, including expired ones so they can be resent. */
  async findAll(orgId: string) {
    const rows = await this.prisma.invitation.findMany({
      where: { orgId, ...pendingWhere },
      select: invitationSelect,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toListItem);
  }

  async revoke(actor: AuthenticatedUser, id: string) {
    const inv = await this.prisma.invitation.findFirst({
      where: { id, orgId: actor.orgId, ...pendingWhere },
      include: { role: { include: { permissions: true } } },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    assertWithinOwnPermissions(
      actor,
      toPermissionMap(inv.role.permissions, inv.role.isSystem),
      'revoke an invitation',
    );
    await this.prisma.invitation.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return { id, revoked: true };
  }

  /* ── Public (token-based) ── */

  /** What the accept page shows. 404 = unknown / used / revoked; 410 = expired. */
  async preview(token: string) {
    const inv = await this.findUsable(token);
    return {
      email: inv.email,
      name: inv.name,
      expiresAt: inv.expiresAt,
      org: { name: inv.org.name },
      role: { name: inv.role.name },
    };
  }

  /** Create the account, mark the invite used and sign the new member in. */
  async accept(token: string, dto: AcceptInvitationDto) {
    const inv = await this.findUsable(token);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    let userId: string;
    try {
      userId = await this.prisma.$transaction(async (tx) => {
        // Claim the invite atomically so two concurrent accepts can't both succeed.
        const claimed = await tx.invitation.updateMany({
          where: { id: inv.id, ...pendingWhere, expiresAt: { gt: new Date() } },
          data: { acceptedAt: new Date() },
        });
        if (claimed.count === 0)
          throw new NotFoundException(
            'This invitation link is no longer valid',
          );
        const user = await tx.user.create({
          data: {
            orgId: inv.orgId,
            roleId: inv.roleId,
            email: inv.email,
            name: dto.name,
            passwordHash,
          },
        });
        return user.id;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists — sign in instead',
        );
      }
      throw e;
    }
    return this.auth.issueSession(userId);
  }

  private async findUsable(token: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        org: { select: { name: true } },
        role: { select: { name: true } },
      },
    });
    if (!inv || inv.acceptedAt || inv.revokedAt) {
      throw new NotFoundException('This invitation link is no longer valid');
    }
    if (inv.expiresAt <= new Date()) {
      throw new GoneException(
        'This invitation has expired — ask for a new one',
      );
    }
    return inv;
  }
}

function toListItem(inv: {
  id: string;
  email: string;
  name: string | null;
  expiresAt: Date;
  createdAt: Date;
  role: { id: string; name: string; isSystem: boolean };
  invitedBy: { id: string; name: string };
}) {
  return {
    ...inv,
    status:
      inv.expiresAt <= new Date() ? ('EXPIRED' as const) : ('PENDING' as const),
  };
}

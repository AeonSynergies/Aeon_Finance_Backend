import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { toPermissionMap } from '../permissions/permissions.catalog';
import type { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', 10);

const profileInclude = {
  org: { select: { id: true, name: true, slug: true } },
  role: { include: { permissions: true } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: profileInclude,
    });

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    // Same message for unknown email, wrong password and deactivated accounts,
    // so the endpoint can't be used to discover which emails exist.
    if (!user || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user.id);
  }

  /** Sign a token for a user and return it with their profile (login / invite accept). */
  async issueSession(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: profileInclude,
    });
    const payload: JwtPayload = { sub: user.id, orgId: user.orgId };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, user: this.toProfile(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: profileInclude,
    });
    return this.toProfile(user);
  }

  private toProfile(user: {
    id: string;
    name: string;
    email: string;
    org: { id: string; name: string; slug: string };
    role: {
      id: string;
      name: string;
      isSystem: boolean;
      permissions: Parameters<typeof toPermissionMap>[0];
    };
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      org: user.org,
      role: {
        id: user.role.id,
        name: user.role.name,
        isSystem: user.role.isSystem,
      },
      permissions: toPermissionMap(user.role.permissions, user.role.isSystem),
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  toPermissionMap,
  type PermissionMap,
} from '../../permissions/permissions.catalog';

export interface JwtPayload {
  sub: string;
  orgId: string;
}

export interface AuthenticatedUser {
  userId: string;
  orgId: string;
  roleId: string;
  roleName: string;
  isSystemRole: boolean;
  permissions: PermissionMap;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Permissions are resolved from the database on every request (not baked into
   * the token), so role changes and deactivation take effect immediately.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: { include: { permissions: true } } },
    });
    if (!user || !user.isActive || user.orgId !== payload.orgId) {
      throw new UnauthorizedException('Your session is no longer valid');
    }
    return {
      userId: user.id,
      orgId: user.orgId,
      roleId: user.roleId,
      roleName: user.role.name,
      isSystemRole: user.role.isSystem,
      permissions: toPermissionMap(user.role.permissions, user.role.isSystem),
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { permissions: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const permissions = new Set<string>();
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        permissions.add(permission.name);
      }
    }

    return {
      id: user.id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      roles: user.roles.map((role) => role.name),
      permissions: Array.from(permissions),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class OptionalAuthService {
  private readonly jwtService: JwtService;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.jwtService = new JwtService({
      secret: this.configService.get<string>('jwt.accessSecret'),
    });
  }

  async resolveOptionalUser(
    request: Request,
  ): Promise<AuthenticatedUser | undefined> {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string }>(
        header.slice('Bearer '.length),
      );

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { roles: { include: { permissions: true } } },
      });

      if (!user || !user.isActive) {
        return undefined;
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
    } catch {
      return undefined;
    }
  }
}

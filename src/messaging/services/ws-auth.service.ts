import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

export interface WsAuthenticatedUser {
  id: string;
  email: string;
  isActive: boolean;
  roles: string[];
}

@Injectable()
export class WsAuthService {
  private readonly jwtService: JwtService;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.jwtService = new JwtService({
      secret: this.configService.get<string>('jwt.accessSecret'),
    });
  }

  async authenticate(socket: Socket): Promise<WsAuthenticatedUser> {
    const token = this.extractToken(socket);

    if (!token) {
      throw new WsException('Authentication token missing');
    }

    let payload: { sub: string };
    try {
      payload = this.jwtService.verify<{ sub: string }>(token);
    } catch {
      throw new WsException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: true },
    });

    if (!user || !user.isActive) {
      throw new WsException('Invalid or expired session');
    }

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      roles: user.roles.map((role) => role.name),
    };
  }

  private extractToken(socket: Socket): string | undefined {
    const authToken = socket.handshake.auth?.token as string | undefined;
    if (authToken) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const header = socket.handshake.headers.authorization;
    if (header) {
      return header.replace(/^Bearer\s+/i, '');
    }

    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return undefined;
  }
}

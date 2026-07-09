import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { StringValue } from 'ms';
import type {
  AuthenticatedUser,
  JwtPayload,
  RefreshTokenPayload,
} from '../interfaces/jwt-payload.interface';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly accessTokenSigner: JwtService;
  private readonly refreshTokenSigner: JwtService;

  constructor(private readonly configService: ConfigService) {
    this.accessTokenSigner = new JwtService({
      secret: this.configService.get<string>('jwt.accessSecret'),
      signOptions: {
        expiresIn: this.configService.get<string>(
          'jwt.accessExpiresIn',
        ) as StringValue,
      },
    });

    this.refreshTokenSigner = new JwtService({
      secret: this.configService.get<string>('jwt.refreshSecret'),
      signOptions: {
        expiresIn: this.configService.get<string>(
          'jwt.refreshExpiresIn',
        ) as StringValue,
      },
    });
  }

  generateAccessToken(
    user: Pick<AuthenticatedUser, 'id' | 'email' | 'roles' | 'permissions'>,
  ): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    };
    return this.accessTokenSigner.sign(payload);
  }

  generateRefreshToken(userId: string): {
    token: string;
    jti: string;
    expiresAt: Date;
  } {
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub: userId, jti };
    const token = this.refreshTokenSigner.sign(payload);
    const expiresAt = this.getExpiryFromToken(token);
    return { token, jti, expiresAt };
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return this.refreshTokenSigner.verify<RefreshTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getExpiryFromToken(token: string): Date {
    const decoded = this.refreshTokenSigner.decode<{ exp: number }>(token);
    return new Date(decoded.exp * 1000);
  }
}

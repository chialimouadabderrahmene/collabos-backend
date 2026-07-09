import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  DEFAULT_ROLE,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from './auth.constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuditLogService } from './services/audit-log.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import {
  AuthTokensResponse,
  MessageResponse,
} from './types/auth-response.type';
import { RequestMetadata } from './interfaces/request-metadata.interface';
import { RefreshTokenPayload } from './interfaces/jwt-payload.interface';

type UserWithRoles = Awaited<ReturnType<AuthService['findUserWithRoles']>>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly auditLogService: AuditLogService,
    private readonly mailService: MailService,
  ) {}

  async register(
    dto: RegisterDto,
    meta: RequestMetadata,
  ): Promise<MessageResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        roles: { connect: { name: DEFAULT_ROLE } },
      },
    });

    await this.issueEmailVerificationToken(user.id, user.email);

    await this.auditLogService.record({
      action: AuditAction.REGISTER,
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      message:
        'Registration successful. Check your email to verify your account.',
    };
  }

  async login(
    dto: LoginDto,
    meta: RequestMetadata,
  ): Promise<AuthTokensResponse> {
    const user = await this.findUserWithRoles({ email: dto.email });

    if (!user) {
      await this.auditLogService.record({
        action: AuditAction.LOGIN_FAILED,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { email: dto.email, reason: 'user_not_found' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      await this.auditLogService.record({
        action: AuditAction.LOGIN_FAILED,
        userId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { reason: 'bad_password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    const tokens = await this.issueTokenPair(user, meta);

    await this.auditLogService.record({
      action: AuditAction.LOGIN_SUCCESS,
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tokens;
  }

  async refresh(
    dto: RefreshTokenDto,
    meta: RequestMetadata,
  ): Promise<AuthTokensResponse> {
    const payload = this.tokenService.verifyRefreshToken(dto.refreshToken);
    const tokenHash = this.tokenService.hashToken(dto.refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.revokedAt ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.findUserWithRoles({ id: payload.sub });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokenPair(user, meta);

    await this.auditLogService.record({
      action: AuditAction.TOKEN_REFRESH,
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tokens;
  }

  async logout(
    dto: LogoutDto,
    meta: RequestMetadata,
  ): Promise<MessageResponse> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.tokenService.verifyRefreshToken(dto.refreshToken);
    } catch {
      return { message: 'Logged out' };
    }

    const tokenHash = this.tokenService.hashToken(dto.refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (stored && !stored.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      await this.auditLogService.record({
        action: AuditAction.LOGOUT,
        userId: payload.sub,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    return { message: 'Logged out' };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    meta: RequestMetadata,
  ): Promise<MessageResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = this.tokenService.hashToken(rawToken);

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });

      const link = `${this.configService.get<string>('app.clientUrl')}/reset-password?token=${rawToken}`;
      await this.mailService.sendPasswordReset(user.email, link);

      await this.auditLogService.record({
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        userId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    return {
      message:
        'If an account exists for this email, a reset link has been sent.',
    };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    meta: RequestMetadata,
  ): Promise<MessageResponse> {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !stored ||
      stored.consumedAt ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditLogService.record({
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      userId: stored.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { message: 'Password has been reset. Please log in again.' };
  }

  async verifyEmail(
    dto: VerifyEmailDto,
    meta: RequestMetadata,
  ): Promise<MessageResponse> {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const stored = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (
      !stored ||
      stored.consumedAt ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { isEmailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: stored.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    await this.auditLogService.record({
      action: AuditAction.EMAIL_VERIFIED,
      userId: stored.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { message: 'Email verified successfully.' };
  }

  private async issueEmailVerificationToken(
    userId: string,
    email: string,
  ): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.tokenService.hashToken(rawToken);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });

    const link = `${this.configService.get<string>('app.clientUrl')}/verify-email?token=${rawToken}`;
    await this.mailService.sendEmailVerification(email, link);
  }

  private async issueTokenPair(
    user: NonNullable<UserWithRoles>,
    meta: RequestMetadata,
  ): Promise<AuthTokensResponse> {
    const permissions = this.flattenPermissions(user.roles);
    const roleNames = user.roles.map((role) => role.name);

    const accessToken = this.tokenService.generateAccessToken({
      id: user.id,
      email: user.email,
      roles: roleNames,
      permissions,
    });

    const { token: refreshToken, expiresAt } =
      this.tokenService.generateRefreshToken(user.id);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokenService.hashToken(refreshToken),
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        roles: roleNames,
        permissions,
      },
    };
  }

  private flattenPermissions(
    roles: Array<Role & { permissions: { name: string }[] }>,
  ): string[] {
    const permissions = new Set<string>();
    for (const role of roles) {
      for (const permission of role.permissions) {
        permissions.add(permission.name);
      }
    }
    return Array.from(permissions);
  }

  private findUserWithRoles(where: { id?: string; email?: string }) {
    return this.prisma.user.findUnique({
      where: where.id ? { id: where.id } : { email: where.email! },
      include: { roles: { include: { permissions: true } } },
    });
  }
}

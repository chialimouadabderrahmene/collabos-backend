import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';
import type { RequestMetadata } from './interfaces/request-metadata.interface';
import {
  AuthTokensResponse,
  MessageResponse,
  UserProfileResponse,
} from './types/auth-response.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  @ApiResponse({ status: 201, type: MessageResponse })
  register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    return this.authService.register(dto, this.extractMeta(req));
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, type: AuthTokensResponse })
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthTokensResponse> {
    return this.authService.login(dto, this.extractMeta(req));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiResponse({ status: 200, type: AuthTokensResponse })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthTokensResponse> {
    return this.authService.refresh(dto, this.extractMeta(req));
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token' })
  @ApiResponse({ status: 200, type: MessageResponse })
  logout(
    @Body() dto: LogoutDto,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    return this.authService.logout(dto, this.extractMeta(req));
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, type: MessageResponse })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    return this.authService.forgotPassword(dto, this.extractMeta(req));
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using a reset token' })
  @ApiResponse({ status: 200, type: MessageResponse })
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    return this.authService.resetPassword(dto, this.extractMeta(req));
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({
    summary: 'Verify an email address using a verification token',
  })
  @ApiResponse({ status: 200, type: MessageResponse })
  verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
  ): Promise<MessageResponse> {
    return this.authService.verifyEmail(dto, this.extractMeta(req));
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiResponse({ status: 200, type: UserProfileResponse })
  me(@CurrentUser() user: AuthenticatedUser): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  private extractMeta(req: Request): RequestMetadata {
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}

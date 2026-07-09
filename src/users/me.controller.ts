import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdatePrivacySettingsDto } from './dto/update-privacy-settings.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ProfileService } from './services/profile.service';
import { SettingsService } from './services/settings.service';
import {
  AvatarResponse,
  NotificationPreferencesResponse,
  PrivacySettingsResponse,
  UserPreferencesResponse,
  UserResponse,
  UserSettingsResponse,
} from './types/user-response.types';

@ApiTags('users/me')
@ApiBearerAuth()
@Controller('users/me')
export class MeController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiResponse({ status: 200, type: UserResponse })
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    return this.profileService.getProfile(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiResponse({ status: 200, type: UserResponse })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponse> {
    return this.profileService.updateProfile(user.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload a new avatar image' })
  @ApiResponse({ status: 201, type: AvatarResponse })
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<AvatarResponse> {
    return this.profileService.setAvatar(user.id, file);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Remove the current avatar' })
  @ApiResponse({ status: 200, type: AvatarResponse })
  removeAvatar(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AvatarResponse> {
    return this.profileService.removeAvatar(user.id);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get display and locale settings' })
  @ApiResponse({ status: 200, type: UserSettingsResponse })
  getSettings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserSettingsResponse> {
    return this.settingsService.getSettings(user.id);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update display and locale settings' })
  @ApiResponse({ status: 200, type: UserSettingsResponse })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<UserSettingsResponse> {
    return this.settingsService.updateSettings(user.id, dto);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get content and communication preferences' })
  @ApiResponse({ status: 200, type: UserPreferencesResponse })
  getPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserPreferencesResponse> {
    return this.settingsService.getPreferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update content and communication preferences' })
  @ApiResponse({ status: 200, type: UserPreferencesResponse })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<UserPreferencesResponse> {
    return this.settingsService.updatePreferences(user.id, dto);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get notification channel preferences' })
  @ApiResponse({ status: 200, type: NotificationPreferencesResponse })
  getNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationPreferencesResponse> {
    return this.settingsService.getNotificationPreferences(user.id);
  }

  @Patch('notifications')
  @ApiOperation({ summary: 'Update notification channel preferences' })
  @ApiResponse({ status: 200, type: NotificationPreferencesResponse })
  updateNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponse> {
    return this.settingsService.updateNotificationPreferences(user.id, dto);
  }

  @Get('privacy')
  @ApiOperation({ summary: 'Get privacy settings' })
  @ApiResponse({ status: 200, type: PrivacySettingsResponse })
  getPrivacySettings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PrivacySettingsResponse> {
    return this.settingsService.getPrivacySettings(user.id);
  }

  @Patch('privacy')
  @ApiOperation({ summary: 'Update privacy settings' })
  @ApiResponse({ status: 200, type: PrivacySettingsResponse })
  updatePrivacySettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePrivacySettingsDto,
  ): Promise<PrivacySettingsResponse> {
    return this.settingsService.updatePrivacySettings(user.id, dto);
  }
}

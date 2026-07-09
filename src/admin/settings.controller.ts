import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './services/settings.service';
import { PlatformSettingsResponse } from './types/admin-response.types';

@ApiTags('admin/settings')
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get public platform settings' })
  @ApiResponse({ status: 200, type: PlatformSettingsResponse })
  getSettings(): Promise<PlatformSettingsResponse> {
    return this.settingsService.getSettings();
  }

  @Patch()
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update platform settings (admin only)' })
  @ApiResponse({ status: 200, type: PlatformSettingsResponse })
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<PlatformSettingsResponse> {
    return this.settingsService.update(admin, dto);
  }
}

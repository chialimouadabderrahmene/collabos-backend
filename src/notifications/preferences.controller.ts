import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PreferencesService } from './services/preferences.service';
import { PreferencesResponse } from './types/notification-response.types';

@ApiTags('notifications/preferences')
@ApiBearerAuth()
@Controller('notifications/preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notification preferences' })
  @ApiResponse({ status: 200, type: PreferencesResponse })
  getMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PreferencesResponse> {
    return this.preferencesService.getMine(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my notification preferences' })
  @ApiResponse({ status: 200, type: PreferencesResponse })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<PreferencesResponse> {
    return this.preferencesService.update(user.id, dto);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { PushTokensService } from './services/push-tokens.service';
import { PushTokenResponse } from './types/notification-response.types';

@ApiTags('notifications/push')
@ApiBearerAuth()
@Controller('notifications/push/tokens')
export class PushController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Post()
  @ApiOperation({ summary: 'Register a device push token' })
  @ApiResponse({ status: 201, type: PushTokenResponse })
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<PushTokenResponse> {
    return this.pushTokensService.register(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my active device push tokens' })
  @ApiResponse({ status: 200, type: [PushTokenResponse] })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PushTokenResponse[]> {
    return this.pushTokensService.findMine(user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deactivate a device push token' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.pushTokensService.deactivate(id, user.id);
  }
}

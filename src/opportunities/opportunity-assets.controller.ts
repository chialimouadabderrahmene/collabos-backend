import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { Throttle } from '@nestjs/throttler';
import { OpportunityAssetKind } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UpdateAssetDto, UploadAssetDto } from './dto/publishing.dto';
import { OpportunityAssetsService } from './services/opportunity-assets.service';
import {
  AssetResponse,
  MessageResponse,
} from './types/opportunity-response.types';

@ApiTags('opportunities/assets')
@ApiBearerAuth()
@Controller('opportunities/:id/assets')
export class OpportunityAssetsController {
  constructor(private readonly assetsService: OpportunityAssetsService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'kind'],
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: { type: 'string', enum: Object.values(OpportunityAssetKind) },
        altText: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Upload an image, sketch or reference (JPEG/PNG/WEBP/GIF; PDF for references)',
  })
  @ApiResponse({ status: 201, type: AssetResponse })
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadAssetDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<AssetResponse> {
    return this.assetsService.upload(id, user, dto, file);
  }

  @Get()
  @ApiOperation({ summary: 'List live assets with short-lived signed URLs' })
  @ApiResponse({ status: 200, type: [AssetResponse] })
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssetResponse[]> {
    return this.assetsService.list(id, user);
  }

  @Patch(':assetId')
  @ApiOperation({
    summary: 'Update alt text (does not affect published versions)',
  })
  @ApiResponse({ status: 200, type: AssetResponse })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAssetDto,
  ): Promise<AssetResponse> {
    return this.assetsService.updateAltText(id, assetId, user, dto);
  }

  @Delete(':assetId')
  @ApiOperation({
    summary:
      'Delete an asset not used by the draft (kept in storage if a published version uses it)',
  })
  @ApiResponse({ status: 200, type: MessageResponse })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.assetsService.remove(id, assetId, user);
  }
}

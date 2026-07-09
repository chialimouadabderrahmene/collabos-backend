import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
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
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateDropMediaDto } from './dto/create-drop-media.dto';
import { CreateDropProductDto } from './dto/create-drop-product.dto';
import { CreateDropDto } from './dto/create-drop.dto';
import { ListDropsQueryDto } from './dto/list-drops-query.dto';
import { ScheduleDropDto } from './dto/schedule-drop.dto';
import { UpdateDropPageDto } from './dto/update-drop-page.dto';
import { UpdateDropProductDto } from './dto/update-drop-product.dto';
import { UpdateDropSeoDto } from './dto/update-drop-seo.dto';
import { UpdateDropDto } from './dto/update-drop.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { DropMediaService } from './services/drop-media.service';
import { DropPageService } from './services/drop-page.service';
import { DropProductsService } from './services/drop-products.service';
import { DropSeoService } from './services/drop-seo.service';
import { DropsService } from './services/drops.service';
import { OptionalAuthService } from './services/optional-auth.service';
import {
  DropMediaResponse,
  DropPageResponse,
  DropProductResponse,
  DropResponse,
  DropSeoResponse,
  MessageResponse,
  PaginatedDropsResponse,
} from './types/drop-response.types';

@ApiTags('drops')
@Controller('drops')
export class DropsController {
  constructor(
    private readonly dropsService: DropsService,
    private readonly pageService: DropPageService,
    private readonly seoService: DropSeoService,
    private readonly mediaService: DropMediaService,
    private readonly productsService: DropProductsService,
    private readonly optionalAuthService: OptionalAuthService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a drop (brand owner or admin)' })
  @ApiResponse({ status: 201, type: DropResponse })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDropDto,
  ): Promise<DropResponse> {
    return this.dropsService.create(user, dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my drops (as brand owner or admin)' })
  @ApiResponse({ status: 200, type: PaginatedDropsResponse })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDropsQueryDto,
  ): Promise<PaginatedDropsResponse> {
    return this.dropsService.findMine(user, query);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Discover published, public drops' })
  @ApiResponse({ status: 200, type: PaginatedDropsResponse })
  findPublic(
    @Query() query: ListDropsQueryDto,
  ): Promise<PaginatedDropsResponse> {
    return this.dropsService.findPublic(query);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a drop landing page by slug' })
  @ApiResponse({ status: 200, type: DropResponse })
  async findBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<DropResponse> {
    const user = await this.optionalAuthService.resolveOptionalUser(req);
    return this.dropsService.findBySlug(slug, user);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a drop (brand owner or admin)' })
  @ApiResponse({ status: 200, type: DropResponse })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DropResponse> {
    return this.dropsService.findOneOrThrow(id, user);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a drop' })
  @ApiResponse({ status: 200, type: DropResponse })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDropDto,
  ): Promise<DropResponse> {
    return this.dropsService.update(id, user, dto);
  }

  @Post(':id/schedule')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Schedule a draft drop to auto-publish' })
  @ApiResponse({ status: 200, type: DropResponse })
  schedule(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScheduleDropDto,
  ): Promise<DropResponse> {
    return this.dropsService.schedule(id, user, dto);
  }

  @Post(':id/publish')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a drop immediately' })
  @ApiResponse({ status: 200, type: DropResponse })
  publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DropResponse> {
    return this.dropsService.publish(id, user);
  }

  @Post(':id/archive')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a drop' })
  @ApiResponse({ status: 200, type: DropResponse })
  archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DropResponse> {
    return this.dropsService.archive(id, user);
  }

  @Patch(':id/visibility')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change a drop visibility' })
  @ApiResponse({ status: 200, type: DropResponse })
  updateVisibility(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVisibilityDto,
  ): Promise<DropResponse> {
    return this.dropsService.updateVisibility(id, user, dto);
  }

  @Public()
  @Get(':id/page')
  @ApiOperation({ summary: 'Get a drop landing page content' })
  @ApiResponse({ status: 200, type: DropPageResponse })
  async getPage(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<DropPageResponse> {
    const user = await this.optionalAuthService.resolveOptionalUser(req);
    return this.pageService.get(id, user);
  }

  @Patch(':id/page')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a drop landing page content' })
  @ApiResponse({ status: 200, type: DropPageResponse })
  updatePage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDropPageDto,
  ): Promise<DropPageResponse> {
    return this.pageService.update(id, user, dto);
  }

  @Public()
  @Get(':id/seo')
  @ApiOperation({ summary: 'Get drop SEO metadata' })
  @ApiResponse({ status: 200, type: DropSeoResponse })
  async getSeo(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<DropSeoResponse> {
    const user = await this.optionalAuthService.resolveOptionalUser(req);
    return this.seoService.get(id, user);
  }

  @Patch(':id/seo')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update drop SEO metadata' })
  @ApiResponse({ status: 200, type: DropSeoResponse })
  updateSeo(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDropSeoDto,
  ): Promise<DropSeoResponse> {
    return this.seoService.update(id, user, dto);
  }

  @Post(':id/media')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Add a media asset to a drop' })
  @ApiResponse({ status: 201, type: DropMediaResponse })
  addMedia(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDropMediaDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<DropMediaResponse> {
    return this.mediaService.add(id, user, dto, file);
  }

  @Public()
  @Get(':id/media')
  @ApiOperation({ summary: 'List a drop media gallery' })
  @ApiResponse({ status: 200, type: [DropMediaResponse] })
  async findMedia(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<DropMediaResponse[]> {
    const user = await this.optionalAuthService.resolveOptionalUser(req);
    return this.mediaService.findAll(id, user);
  }

  @Delete(':id/media/:mediaId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a media asset from a drop' })
  @ApiResponse({ status: 200, type: MessageResponse })
  removeMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.mediaService.remove(id, mediaId, user);
  }

  @Post(':id/products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a product to a drop' })
  @ApiResponse({ status: 201, type: DropProductResponse })
  createProduct(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDropProductDto,
  ): Promise<DropProductResponse> {
    return this.productsService.create(id, user, dto);
  }

  @Public()
  @Get(':id/products')
  @ApiOperation({ summary: 'List a drop products' })
  @ApiResponse({ status: 200, type: [DropProductResponse] })
  async findProducts(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<DropProductResponse[]> {
    const user = await this.optionalAuthService.resolveOptionalUser(req);
    return this.productsService.findAll(id, user);
  }

  @Patch(':id/products/:productId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a drop product' })
  @ApiResponse({ status: 200, type: DropProductResponse })
  updateProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDropProductDto,
  ): Promise<DropProductResponse> {
    return this.productsService.update(id, productId, user, dto);
  }

  @Delete(':id/products/:productId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a product from a drop' })
  @ApiResponse({ status: 200, type: MessageResponse })
  removeProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.productsService.remove(id, productId, user);
  }
}

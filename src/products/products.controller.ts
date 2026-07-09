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
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AssignCategoriesDto } from './dto/assign-categories.dto';
import { CreateProductMediaDto } from './dto/create-product-media.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ProductMediaService } from './services/product-media.service';
import { ProductVariantsService } from './services/product-variants.service';
import { ProductsService } from './services/products.service';
import { OptionalAuthService } from './services/optional-auth.service';
import { StockService } from './services/stock.service';
import { PaginatedStockMovementsResponse } from './types/paginated-stock-movements-response.type';
import {
  MessageResponse,
  PaginatedProductsResponse,
  ProductMediaResponse,
  ProductResponse,
  VariantResponse,
} from './types/product-response.types';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly variantsService: ProductVariantsService,
    private readonly stockService: StockService,
    private readonly mediaService: ProductMediaService,
    private readonly optionalAuthService: OptionalAuthService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product (brand owner or admin)' })
  @ApiResponse({ status: 201, type: ProductResponse })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ): Promise<ProductResponse> {
    return this.productsService.create(user, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse active products' })
  @ApiResponse({ status: 200, type: PaginatedProductsResponse })
  findAll(
    @Query() query: ListProductsQueryDto,
  ): Promise<PaginatedProductsResponse> {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a product' })
  @ApiResponse({ status: 200, type: ProductResponse })
  async findOne(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<ProductResponse> {
    const user = await this.optionalAuthService.resolveOptionalUser(req);
    return this.productsService.findOneOrThrow(id, user);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, type: ProductResponse })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    return this.productsService.update(id, user, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a product' })
  @ApiResponse({ status: 200, type: MessageResponse })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.productsService.remove(id, user);
  }

  @Patch(':id/categories')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace the categories assigned to a product' })
  @ApiResponse({ status: 200, type: ProductResponse })
  assignCategories(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignCategoriesDto,
  ): Promise<ProductResponse> {
    return this.productsService.assignCategories(id, user, dto.categoryIds);
  }

  @Post(':id/variants')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a variant to a product' })
  @ApiResponse({ status: 201, type: VariantResponse })
  createVariant(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVariantDto,
  ): Promise<VariantResponse> {
    return this.variantsService.create(id, user, dto);
  }

  @Public()
  @Get(':id/variants')
  @ApiOperation({ summary: 'List active variants of a product' })
  @ApiResponse({ status: 200, type: [VariantResponse] })
  async findVariants(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<VariantResponse[]> {
    const user = await this.optionalAuthService.resolveOptionalUser(req);
    return this.variantsService.findAll(id, user);
  }

  @Patch(':id/variants/:variantId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product variant' })
  @ApiResponse({ status: 200, type: VariantResponse })
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVariantDto,
  ): Promise<VariantResponse> {
    return this.variantsService.update(id, variantId, user, dto);
  }

  @Delete(':id/variants/:variantId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a product variant' })
  @ApiResponse({ status: 200, type: MessageResponse })
  removeVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.variantsService.remove(id, variantId, user);
  }

  @Post(':id/variants/:variantId/stock')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a stock movement for a variant' })
  @ApiResponse({ status: 201, type: VariantResponse })
  adjustStock(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdjustStockDto,
  ): Promise<VariantResponse> {
    return this.stockService.adjust(id, variantId, user, dto);
  }

  @Get(':id/variants/:variantId/stock')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List the stock movement ledger for a variant (brand owner or admin)',
  })
  @ApiResponse({ status: 200, type: PaginatedStockMovementsResponse })
  findStockMovements(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListStockMovementsQueryDto,
  ): Promise<PaginatedStockMovementsResponse> {
    return this.stockService.findMovements(id, variantId, user, query);
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
  @ApiOperation({ summary: 'Add a media asset to a product' })
  @ApiResponse({ status: 201, type: ProductMediaResponse })
  addMedia(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductMediaDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ProductMediaResponse> {
    return this.mediaService.add(id, user, dto, file);
  }

  @Public()
  @Get(':id/media')
  @ApiOperation({ summary: 'List a product media gallery' })
  @ApiResponse({ status: 200, type: [ProductMediaResponse] })
  async findMedia(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<ProductMediaResponse[]> {
    const user = await this.optionalAuthService.resolveOptionalUser(req);
    return this.mediaService.findAll(id, user);
  }

  @Delete(':id/media/:mediaId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a media asset from a product' })
  @ApiResponse({ status: 200, type: MessageResponse })
  removeMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.mediaService.remove(id, mediaId, user);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AssignCategoriesDto } from './dto/assign-categories.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { ListBrandsQueryDto } from './dto/list-brands-query.dto';
import { ListFollowersQueryDto } from './dto/list-followers-query.dto';
import { UpdateBrandProfileDto } from './dto/update-brand-profile.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandAssetsService } from './services/brand-assets.service';
import { BrandProfileService } from './services/brand-profile.service';
import { BrandsService } from './services/brands.service';
import { FollowersService } from './services/followers.service';
import {
  BrandProfileResponse,
  BrandResponse,
  CoverResponse,
  FollowResponse,
  LogoResponse,
  MessageResponse,
  PaginatedBrandsResponse,
  PaginatedFollowersResponse,
} from './types/brand-response.types';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
  constructor(
    private readonly brandsService: BrandsService,
    private readonly brandProfileService: BrandProfileService,
    private readonly brandAssetsService: BrandAssetsService,
    private readonly followersService: FollowersService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new brand' })
  @ApiResponse({ status: 201, type: BrandResponse })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBrandDto,
  ): Promise<BrandResponse> {
    return this.brandsService.create(user.id, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search and list brands' })
  @ApiResponse({ status: 200, type: PaginatedBrandsResponse })
  findAll(
    @Query() query: ListBrandsQueryDto,
  ): Promise<PaginatedBrandsResponse> {
    return this.brandsService.findAll(query);
  }

  @Public()
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Get a brand by public slug' })
  @ApiResponse({ status: 200, type: BrandResponse })
  findBySlug(@Param('slug') slug: string): Promise<BrandResponse> {
    return this.brandsService.findBySlugOrThrow(slug);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a brand by id' })
  @ApiResponse({ status: 200, type: BrandResponse })
  findOne(@Param('id') id: string): Promise<BrandResponse> {
    return this.brandsService.findOneOrThrow(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a brand (owner or admin)' })
  @ApiResponse({ status: 200, type: BrandResponse })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBrandDto,
  ): Promise<BrandResponse> {
    return this.brandsService.update(id, user, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a brand (owner or admin)' })
  @ApiResponse({ status: 200, type: MessageResponse })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.brandsService.remove(id, user);
  }

  @Patch(':id/categories')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace the categories assigned to a brand' })
  @ApiResponse({ status: 200, type: BrandResponse })
  assignCategories(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignCategoriesDto,
  ): Promise<BrandResponse> {
    return this.brandsService.assignCategories(id, user, dto.categoryIds);
  }

  @Public()
  @Get(':id/profile')
  @ApiOperation({ summary: 'Get a brand profile' })
  @ApiResponse({ status: 200, type: BrandProfileResponse })
  getProfile(@Param('id') id: string): Promise<BrandProfileResponse> {
    return this.brandProfileService.getProfile(id);
  }

  @Patch(':id/profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a brand profile (owner or admin)' })
  @ApiResponse({ status: 200, type: BrandProfileResponse })
  updateProfile(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBrandProfileDto,
  ): Promise<BrandProfileResponse> {
    return this.brandProfileService.updateProfile(id, user, dto);
  }

  @Post(':id/logo')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('logo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { logo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload a brand logo (owner or admin)' })
  @ApiResponse({ status: 201, type: LogoResponse })
  uploadLogo(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<LogoResponse> {
    return this.brandAssetsService.setLogo(id, user, file);
  }

  @Delete(':id/logo')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a brand logo (owner or admin)' })
  @ApiResponse({ status: 200, type: LogoResponse })
  removeLogo(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LogoResponse> {
    return this.brandAssetsService.removeLogo(id, user);
  }

  @Post(':id/cover')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('cover'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { cover: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload a brand cover image (owner or admin)' })
  @ApiResponse({ status: 201, type: CoverResponse })
  uploadCover(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<CoverResponse> {
    return this.brandAssetsService.setCover(id, user, file);
  }

  @Delete(':id/cover')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a brand cover image (owner or admin)' })
  @ApiResponse({ status: 200, type: CoverResponse })
  removeCover(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CoverResponse> {
    return this.brandAssetsService.removeCover(id, user);
  }

  @Post(':id/verify')
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Mark a brand as verified (admin only)' })
  @ApiResponse({ status: 200, type: BrandResponse })
  verify(@Param('id') id: string): Promise<BrandResponse> {
    return this.brandsService.verify(id);
  }

  @Delete(':id/verify')
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Revoke brand verification (admin only)' })
  @ApiResponse({ status: 200, type: BrandResponse })
  unverify(@Param('id') id: string): Promise<BrandResponse> {
    return this.brandsService.unverify(id);
  }

  @Post(':id/follow')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a brand' })
  @ApiResponse({ status: 201, type: FollowResponse })
  follow(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FollowResponse> {
    return this.followersService.follow(id, user.id);
  }

  @Delete(':id/follow')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a brand' })
  @ApiResponse({ status: 200, type: FollowResponse })
  unfollow(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FollowResponse> {
    return this.followersService.unfollow(id, user.id);
  }

  @Public()
  @Get(':id/followers')
  @ApiOperation({ summary: 'List a brand followers' })
  @ApiResponse({ status: 200, type: PaginatedFollowersResponse })
  listFollowers(
    @Param('id') id: string,
    @Query() query: ListFollowersQueryDto,
  ): Promise<PaginatedFollowersResponse> {
    return this.followersService.listFollowers(id, query);
  }
}

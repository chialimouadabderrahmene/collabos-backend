import { Module } from '@nestjs/common';
import { BrandMembersController } from './brand-members.controller';
import { BrandsController } from './brands.controller';
import { CategoriesController } from './categories.controller';
import { BrandAccessService } from './services/brand-access.service';
import { BrandAssetStorageService } from './services/brand-asset-storage.service';
import { BrandAssetsService } from './services/brand-assets.service';
import { BrandMembersService } from './services/brand-members.service';
import { BrandProfileService } from './services/brand-profile.service';
import { BrandsService } from './services/brands.service';
import { CategoriesService } from './services/categories.service';
import { FollowersService } from './services/followers.service';

@Module({
  controllers: [BrandsController, CategoriesController, BrandMembersController],
  providers: [
    BrandsService,
    BrandProfileService,
    BrandAssetsService,
    BrandAssetStorageService,
    CategoriesService,
    FollowersService,
    BrandAccessService,
    BrandMembersService,
  ],
  exports: [BrandsService, BrandAccessService],
})
export class BrandsModule {}

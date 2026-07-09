import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { CategoriesController } from './categories.controller';
import { BrandAssetStorageService } from './services/brand-asset-storage.service';
import { BrandAssetsService } from './services/brand-assets.service';
import { BrandProfileService } from './services/brand-profile.service';
import { BrandsService } from './services/brands.service';
import { CategoriesService } from './services/categories.service';
import { FollowersService } from './services/followers.service';

@Module({
  controllers: [BrandsController, CategoriesController],
  providers: [
    BrandsService,
    BrandProfileService,
    BrandAssetsService,
    BrandAssetStorageService,
    CategoriesService,
    FollowersService,
  ],
  exports: [BrandsService],
})
export class BrandsModule {}

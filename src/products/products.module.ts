import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductMediaStorageService } from './services/product-media-storage.service';
import { ProductMediaService } from './services/product-media.service';
import { ProductVariantsService } from './services/product-variants.service';
import { ProductsService } from './services/products.service';
import { OptionalAuthService } from './services/optional-auth.service';
import { StockService } from './services/stock.service';

@Module({
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductVariantsService,
    StockService,
    ProductMediaService,
    ProductMediaStorageService,
    OptionalAuthService,
  ],
  exports: [ProductsService],
})
export class ProductsModule {}

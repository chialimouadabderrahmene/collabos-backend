import {
  Category,
  Product,
  ProductMedia,
  ProductVariant,
  StockMovement,
} from '@prisma/client';
import {
  ProductMediaResponse,
  ProductResponse,
  StockMovementResponse,
  VariantResponse,
} from '../types/product-response.types';

type ProductWithRelations = Product & {
  categories: Category[];
  variants: ProductVariant[];
};

export function toProductResponse(
  product: ProductWithRelations,
): ProductResponse {
  return {
    id: product.id,
    brandId: product.brandId,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    isActive: product.isActive,
    categories: product.categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    totalStock: product.variants.reduce(
      (sum, variant) => sum + variant.stockQuantity,
      0,
    ),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function toVariantResponse(
  variant: ProductVariant,
  productPrice: number,
): VariantResponse {
  return {
    id: variant.id,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    priceOverride: variant.priceOverride,
    effectivePrice: variant.priceOverride ?? productPrice,
    stockQuantity: variant.stockQuantity,
    isActive: variant.isActive,
  };
}

export function toProductMediaResponse(
  media: ProductMedia,
): ProductMediaResponse {
  return {
    id: media.id,
    url: media.url,
    altText: media.altText,
    position: media.position,
  };
}

export function toStockMovementResponse(
  movement: StockMovement,
): StockMovementResponse {
  return {
    id: movement.id,
    type: movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
    createdAt: movement.createdAt,
  };
}

import {
  Drop,
  DropMedia,
  DropPage,
  DropProduct,
  DropSeo,
} from '@prisma/client';
import {
  DropMediaResponse,
  DropPageResponse,
  DropProductResponse,
  DropResponse,
  DropSeoResponse,
} from '../types/drop-response.types';

export function toDropResponse(drop: Drop): DropResponse {
  return {
    id: drop.id,
    brandId: drop.brandId,
    dealId: drop.dealId,
    title: drop.title,
    slug: drop.slug,
    description: drop.description,
    status: drop.status,
    visibility: drop.visibility,
    publishAt: drop.publishAt,
    publishedAt: drop.publishedAt,
    archivedAt: drop.archivedAt,
    createdAt: drop.createdAt,
    updatedAt: drop.updatedAt,
  };
}

export function toDropPageResponse(page: DropPage): DropPageResponse {
  return {
    headline: page.headline,
    subheadline: page.subheadline,
    heroImageUrl: page.heroImageUrl,
    bodyContent: page.bodyContent,
    ctaLabel: page.ctaLabel,
    ctaUrl: page.ctaUrl,
  };
}

export function toDropSeoResponse(seo: DropSeo): DropSeoResponse {
  return {
    metaTitle: seo.metaTitle,
    metaDescription: seo.metaDescription,
    ogImageUrl: seo.ogImageUrl,
    canonicalUrl: seo.canonicalUrl,
    keywords: seo.keywords,
  };
}

export function toDropMediaResponse(media: DropMedia): DropMediaResponse {
  return {
    id: media.id,
    url: media.url,
    type: media.type,
    altText: media.altText,
    position: media.position,
  };
}

export function toDropProductResponse(
  product: DropProduct,
): DropProductResponse {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    currency: product.currency,
    sku: product.sku,
    stockQuantity: product.stockQuantity,
    imageUrl: product.imageUrl,
    position: product.position,
    isAvailable: product.isAvailable,
  };
}

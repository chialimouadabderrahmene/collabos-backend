import { Brand, BrandProfile, Category } from '@prisma/client';
import { BrandResponse } from '../types/brand-response.types';

export type BrandWithRelations = Brand & {
  profile: BrandProfile | null;
  categories: Category[];
};

export function toBrandResponse(brand: BrandWithRelations): BrandResponse {
  return {
    id: brand.id,
    ownerId: brand.ownerId,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
    coverUrl: brand.coverUrl,
    isVerified: brand.isVerified,
    verifiedAt: brand.verifiedAt,
    followersCount: brand.followersCount,
    isActive: brand.isActive,
    categories: brand.categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    profile: brand.profile
      ? {
          description: brand.profile.description,
          websiteUrl: brand.profile.websiteUrl,
          instagramHandle: brand.profile.instagramHandle,
          contactEmail: brand.profile.contactEmail,
          foundedYear: brand.profile.foundedYear,
          location: brand.profile.location,
        }
      : null,
    createdAt: brand.createdAt,
  };
}

import { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

export const PRODUCTS_COLLECTION = 'products';
export const BRANDS_COLLECTION = 'brands';
export const DROPS_COLLECTION = 'drops';

export const PRODUCTS_SCHEMA: CollectionCreateSchema = {
  name: PRODUCTS_COLLECTION,
  fields: [
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string', optional: true },
    { name: 'slug', type: 'string' },
    { name: 'brandId', type: 'string', facet: true },
    { name: 'price', type: 'int32' },
    { name: 'isActive', type: 'bool', facet: true },
    { name: 'updatedAt', type: 'int64', sort: true },
  ],
  default_sorting_field: 'updatedAt',
};

export const BRANDS_SCHEMA: CollectionCreateSchema = {
  name: BRANDS_COLLECTION,
  fields: [
    { name: 'name', type: 'string' },
    { name: 'slug', type: 'string' },
    { name: 'isVerified', type: 'bool', facet: true },
    { name: 'isActive', type: 'bool', facet: true },
    { name: 'updatedAt', type: 'int64', sort: true },
  ],
  default_sorting_field: 'updatedAt',
};

export const DROPS_SCHEMA: CollectionCreateSchema = {
  name: DROPS_COLLECTION,
  fields: [
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string', optional: true },
    { name: 'slug', type: 'string' },
    { name: 'brandId', type: 'string', facet: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'updatedAt', type: 'int64', sort: true },
  ],
  default_sorting_field: 'updatedAt',
};

export const ALL_COLLECTION_SCHEMAS: CollectionCreateSchema[] = [
  PRODUCTS_SCHEMA,
  BRANDS_SCHEMA,
  DROPS_SCHEMA,
];

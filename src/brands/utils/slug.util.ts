import { randomBytes } from 'node:crypto';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function withUniqueSuffix(slug: string): string {
  return `${slug}-${randomBytes(3).toString('hex')}`;
}

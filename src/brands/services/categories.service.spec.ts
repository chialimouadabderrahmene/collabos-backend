import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let prisma: {
    category: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let service: CategoriesService;

  beforeEach(() => {
    prisma = {
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    };
    service = new CategoriesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('slugifies the name and creates the category', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        id: 'cat-1',
        name: 'Streetwear',
        slug: 'streetwear',
      });

      await service.create({ name: 'Streetwear' });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Streetwear', slug: 'streetwear' },
      });
    });

    it('rejects duplicate category names', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'cat-1',
        name: 'Streetwear',
        slug: 'streetwear',
      });

      await expect(
        service.create({ name: 'Streetwear' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.category.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns categories ordered by name', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Denim', slug: 'denim' },
      ]);

      const result = await service.findAll();

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });
});

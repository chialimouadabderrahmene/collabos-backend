import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { CategoryResponse } from '../types/brand-response.types';
import { slugify } from '../utils/slug.util';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CategoryResponse[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponse> {
    const slug = slugify(dto.name);

    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });

    if (existing) {
      throw new ConflictException('A category with this name already exists');
    }

    return this.prisma.category.create({ data: { name: dto.name, slug } });
  }
}

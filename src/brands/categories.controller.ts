import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoriesService } from './services/categories.service';
import { CategoryResponse } from './types/brand-response.types';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all brand categories' })
  @ApiResponse({ status: 200, type: [CategoryResponse] })
  findAll(): Promise<CategoryResponse[]> {
    return this.categoriesService.findAll();
  }

  @Post()
  @ApiBearerAuth()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a brand category (admin only)' })
  @ApiResponse({ status: 201, type: CategoryResponse })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryResponse> {
    return this.categoriesService.create(dto);
  }
}

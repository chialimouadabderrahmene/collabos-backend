import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ListAdminBrandsQueryDto } from './dto/list-admin-brands-query.dto';
import { AdminBrandsService } from './services/admin-brands.service';
import {
  AdminBrandResponse,
  PaginatedAdminBrandsResponse,
} from './types/admin-response.types';

@ApiTags('admin/brands')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(private readonly adminBrandsService: AdminBrandsService) {}

  @Get()
  @ApiOperation({ summary: 'List brands' })
  @ApiResponse({ status: 200, type: PaginatedAdminBrandsResponse })
  findAll(
    @Query() query: ListAdminBrandsQueryDto,
  ): Promise<PaginatedAdminBrandsResponse> {
    return this.adminBrandsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a brand' })
  @ApiResponse({ status: 200, type: AdminBrandResponse })
  findOne(@Param('id') id: string): Promise<AdminBrandResponse> {
    return this.adminBrandsService.findOneOrThrow(id);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify a brand' })
  @ApiResponse({ status: 200, type: AdminBrandResponse })
  verify(@Param('id') id: string): Promise<AdminBrandResponse> {
    return this.adminBrandsService.verify(id);
  }

  @Post(':id/unverify')
  @ApiOperation({ summary: "Revoke a brand's verification" })
  @ApiResponse({ status: 200, type: AdminBrandResponse })
  unverify(@Param('id') id: string): Promise<AdminBrandResponse> {
    return this.adminBrandsService.unverify(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Reactivate a deactivated brand' })
  @ApiResponse({ status: 200, type: AdminBrandResponse })
  activate(@Param('id') id: string): Promise<AdminBrandResponse> {
    return this.adminBrandsService.activate(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a brand' })
  @ApiResponse({ status: 200, type: AdminBrandResponse })
  deactivate(@Param('id') id: string): Promise<AdminBrandResponse> {
    return this.adminBrandsService.deactivate(id);
  }
}

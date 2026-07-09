import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateBriefDto } from './dto/create-brief.dto';
import { ListBriefsQueryDto } from './dto/list-briefs-query.dto';
import { UpdateBriefDto } from './dto/update-brief.dto';
import { BriefsService } from './services/briefs.service';
import {
  BriefResponse,
  MessageResponse,
  PaginatedBriefsResponse,
} from './types/brief-response.types';

@ApiTags('briefs')
@Controller('briefs')
export class BriefsController {
  constructor(private readonly briefsService: BriefsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a brief (brand owner or admin)' })
  @ApiResponse({ status: 201, type: BriefResponse })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBriefDto,
  ): Promise<BriefResponse> {
    return this.briefsService.create(user, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search and filter briefs' })
  @ApiResponse({ status: 200, type: PaginatedBriefsResponse })
  findAll(
    @Query() query: ListBriefsQueryDto,
  ): Promise<PaginatedBriefsResponse> {
    return this.briefsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a brief by id' })
  @ApiResponse({ status: 200, type: BriefResponse })
  findOne(@Param('id') id: string): Promise<BriefResponse> {
    return this.briefsService.findOneOrThrow(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit an open brief (brand owner or admin)' })
  @ApiResponse({ status: 200, type: BriefResponse })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBriefDto,
  ): Promise<BriefResponse> {
    return this.briefsService.update(id, user, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a brief (brand owner or admin)' })
  @ApiResponse({ status: 200, type: MessageResponse })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    return this.briefsService.remove(id, user);
  }

  @Post(':id/close')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Close an open brief (brand owner or admin)' })
  @ApiResponse({ status: 200, type: BriefResponse })
  close(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BriefResponse> {
    return this.briefsService.close(id, user);
  }

  @Post(':id/archive')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a brief (brand owner or admin)' })
  @ApiResponse({ status: 200, type: BriefResponse })
  archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BriefResponse> {
    return this.briefsService.archive(id, user);
  }
}

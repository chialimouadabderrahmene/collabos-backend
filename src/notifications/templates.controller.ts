import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './services/templates.service';
import { TemplateResponse } from './types/notification-response.types';

@ApiTags('notifications/templates')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('notifications/templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a notification template' })
  @ApiResponse({ status: 201, type: TemplateResponse })
  create(@Body() dto: CreateTemplateDto): Promise<TemplateResponse> {
    return this.templatesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all notification templates' })
  @ApiResponse({ status: 200, type: [TemplateResponse] })
  findAll(): Promise<TemplateResponse[]> {
    return this.templatesService.findAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a notification template' })
  @ApiResponse({ status: 200, type: TemplateResponse })
  findOne(@Param('key') key: string): Promise<TemplateResponse> {
    return this.templatesService.findOneOrThrow(key);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a notification template' })
  @ApiResponse({ status: 200, type: TemplateResponse })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateTemplateDto,
  ): Promise<TemplateResponse> {
    return this.templatesService.update(key, dto);
  }
}

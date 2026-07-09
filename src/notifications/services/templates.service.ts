import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';
import { toTemplateResponse } from '../mappers/notification.mapper';
import { TemplateResponse } from '../types/notification-response.types';

export interface RenderedTemplate {
  emailSubject: string | null;
  emailBody: string | null;
  pushTitle: string | null;
  pushBody: string | null;
  inAppBody: string | null;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTemplateDto): Promise<TemplateResponse> {
    const existing = await this.prisma.notificationTemplate.findUnique({
      where: { key: dto.key },
    });

    if (existing) {
      throw new ConflictException(
        `A template with key "${dto.key}" already exists`,
      );
    }

    const template = await this.prisma.notificationTemplate.create({
      data: dto,
    });

    return toTemplateResponse(template);
  }

  async findAll(): Promise<TemplateResponse[]> {
    const templates = await this.prisma.notificationTemplate.findMany({
      orderBy: { key: 'asc' },
    });

    return templates.map((template) => toTemplateResponse(template));
  }

  async findOneOrThrow(key: string): Promise<TemplateResponse> {
    const template = await this.getActiveOrThrow(key);
    return toTemplateResponse(template);
  }

  async update(key: string, dto: UpdateTemplateDto): Promise<TemplateResponse> {
    await this.getEntityOrThrow(key);

    const template = await this.prisma.notificationTemplate.update({
      where: { key },
      data: dto,
    });

    return toTemplateResponse(template);
  }

  async getEntityOrThrow(key: string): Promise<NotificationTemplate> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { key },
    });

    if (!template) {
      throw new NotFoundException(`No template found for key "${key}"`);
    }

    return template;
  }

  async getActiveOrThrow(key: string): Promise<NotificationTemplate> {
    const template = await this.getEntityOrThrow(key);

    if (!template.isActive) {
      throw new NotFoundException(`Template "${key}" is not active`);
    }

    return template;
  }

  render(
    template: NotificationTemplate,
    variables: Record<string, string>,
  ): RenderedTemplate {
    return {
      emailSubject: this.interpolate(template.emailSubject, variables),
      emailBody: this.interpolate(template.emailBody, variables),
      pushTitle: this.interpolate(template.pushTitle, variables),
      pushBody: this.interpolate(template.pushBody, variables),
      inAppBody: this.interpolate(template.inAppBody, variables),
    };
  }

  private interpolate(
    content: string | null,
    variables: Record<string, string>,
  ): string | null {
    if (!content) {
      return content;
    }

    return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
      Object.prototype.hasOwnProperty.call(variables, key)
        ? variables[key]
        : match,
    );
  }
}

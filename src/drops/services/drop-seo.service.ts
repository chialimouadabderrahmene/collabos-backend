import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateDropSeoDto } from '../dto/update-drop-seo.dto';
import { toDropSeoResponse } from '../mappers/drop.mapper';
import { DropSeoResponse } from '../types/drop-response.types';
import { DropsService } from './drops.service';

@Injectable()
export class DropSeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dropsService: DropsService,
  ) {}

  async get(
    dropId: string,
    user?: AuthenticatedUser,
  ): Promise<DropSeoResponse> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertViewable(drop, user);

    const seo = await this.prisma.dropSeo.upsert({
      where: { dropId },
      update: {},
      create: { dropId },
    });

    return toDropSeoResponse(seo);
  }

  async update(
    dropId: string,
    user: AuthenticatedUser,
    dto: UpdateDropSeoDto,
  ): Promise<DropSeoResponse> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertOwnerOrAdmin(drop, user);

    const seo = await this.prisma.dropSeo.upsert({
      where: { dropId },
      update: dto,
      create: { dropId, ...dto },
    });

    return toDropSeoResponse(seo);
  }
}

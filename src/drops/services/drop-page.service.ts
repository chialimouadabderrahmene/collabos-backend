import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateDropPageDto } from '../dto/update-drop-page.dto';
import { toDropPageResponse } from '../mappers/drop.mapper';
import { DropPageResponse } from '../types/drop-response.types';
import { DropsService } from './drops.service';

@Injectable()
export class DropPageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dropsService: DropsService,
  ) {}

  async get(
    dropId: string,
    user?: AuthenticatedUser,
  ): Promise<DropPageResponse> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertViewable(drop, user);

    const page = await this.prisma.dropPage.upsert({
      where: { dropId },
      update: {},
      create: { dropId },
    });

    return toDropPageResponse(page);
  }

  async update(
    dropId: string,
    user: AuthenticatedUser,
    dto: UpdateDropPageDto,
  ): Promise<DropPageResponse> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertOwnerOrAdmin(drop, user);

    const page = await this.prisma.dropPage.upsert({
      where: { dropId },
      update: dto,
      create: { dropId, ...dto },
    });

    return toDropPageResponse(page);
  }
}

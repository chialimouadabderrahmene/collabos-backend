import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDropMediaDto } from '../dto/create-drop-media.dto';
import { toDropMediaResponse } from '../mappers/drop.mapper';
import {
  DropMediaResponse,
  MessageResponse,
} from '../types/drop-response.types';
import { DropMediaStorageService } from './drop-media-storage.service';
import { DropsService } from './drops.service';

@Injectable()
export class DropMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dropsService: DropsService,
    private readonly mediaStorage: DropMediaStorageService,
  ) {}

  async add(
    dropId: string,
    user: AuthenticatedUser,
    dto: CreateDropMediaDto,
    file: Express.Multer.File | undefined,
  ): Promise<DropMediaResponse> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertOwnerOrAdmin(drop, user);

    if (!file) {
      throw new BadRequestException('A media file is required');
    }

    if (file.size > this.mediaStorage.getMaxSizeBytes()) {
      throw new PayloadTooLargeException(
        `Media must be smaller than ${this.mediaStorage.getMaxSizeBytes() / (1024 * 1024)}MB`,
      );
    }

    const stored = await this.mediaStorage.save(file);

    const media = await this.prisma.dropMedia.create({
      data: {
        dropId,
        url: stored.url,
        type: stored.type,
        altText: dto.altText,
        position: dto.position ?? 0,
      },
    });

    return toDropMediaResponse(media);
  }

  async findAll(
    dropId: string,
    user?: AuthenticatedUser,
  ): Promise<DropMediaResponse[]> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertViewable(drop, user);

    const media = await this.prisma.dropMedia.findMany({
      where: { dropId },
      orderBy: { position: 'asc' },
    });

    return media.map((item) => toDropMediaResponse(item));
  }

  async remove(
    dropId: string,
    mediaId: string,
    user: AuthenticatedUser,
  ): Promise<MessageResponse> {
    const drop = await this.dropsService.findEntityOrThrow(dropId);
    await this.dropsService.assertOwnerOrAdmin(drop, user);

    const media = await this.prisma.dropMedia.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.dropId !== dropId) {
      throw new NotFoundException('Media not found');
    }

    await this.mediaStorage.delete(media.url);
    await this.prisma.dropMedia.delete({ where: { id: mediaId } });

    return { message: 'Media removed' };
  }
}

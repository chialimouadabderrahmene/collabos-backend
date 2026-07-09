import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { toUserResponse, UserWithRoles } from '../mappers/user.mapper';
import { AvatarResponse, UserResponse } from '../types/user-response.types';
import { AvatarStorageService } from './avatar-storage.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarStorage: AvatarStorageService,
  ) {}

  async getProfile(userId: string): Promise<UserResponse> {
    const user = await this.findWithRolesOrThrow(userId);
    return toUserResponse(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponse> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      include: { roles: true },
    });

    return toUserResponse(user);
  }

  async setAvatar(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<AvatarResponse> {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }

    if (file.size > this.avatarStorage.getMaxSizeBytes()) {
      throw new PayloadTooLargeException(
        `Avatar must be smaller than ${this.avatarStorage.getMaxSizeBytes() / (1024 * 1024)}MB`,
      );
    }

    const current = await this.findWithRolesOrThrow(userId);

    const avatarUrl = await this.avatarStorage.save(userId, file);
    await this.avatarStorage.delete(current.avatarUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return { avatarUrl };
  }

  async removeAvatar(userId: string): Promise<AvatarResponse> {
    const current = await this.findWithRolesOrThrow(userId);

    await this.avatarStorage.delete(current.avatarUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return { avatarUrl: null };
  }

  private async findWithRolesOrThrow(userId: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}

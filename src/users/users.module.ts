import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { AvatarStorageService } from './services/avatar-storage.service';
import { ProfileService } from './services/profile.service';
import { SettingsService } from './services/settings.service';
import { UsersService } from './services/users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [MeController, UsersController],
  providers: [
    UsersService,
    ProfileService,
    SettingsService,
    AvatarStorageService,
  ],
  exports: [UsersService, ProfileService],
})
export class UsersModule {}

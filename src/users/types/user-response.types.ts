import { ApiProperty } from '@nestjs/swagger';
import {
  DigestFrequency,
  MeasurementUnit,
  ProfileVisibility,
  ThemePreference,
} from '@prisma/client';

export class UserResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  isEmailVerified!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ required: false, nullable: true })
  firstName!: string | null;

  @ApiProperty({ required: false, nullable: true })
  lastName!: string | null;

  @ApiProperty({ required: false, nullable: true })
  displayName!: string | null;

  @ApiProperty({ required: false, nullable: true })
  bio!: string | null;

  @ApiProperty({ required: false, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedUsersResponse {
  @ApiProperty({ type: [UserResponse] })
  data!: UserResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class UserSettingsResponse {
  @ApiProperty({ enum: ThemePreference })
  theme!: ThemePreference;

  @ApiProperty()
  language!: string;

  @ApiProperty()
  timezone!: string;
}

export class UserPreferencesResponse {
  @ApiProperty({ enum: DigestFrequency })
  digestFrequency!: DigestFrequency;

  @ApiProperty({ enum: MeasurementUnit })
  measurementUnit!: MeasurementUnit;
}

export class NotificationPreferencesResponse {
  @ApiProperty()
  emailNotifications!: boolean;

  @ApiProperty()
  pushNotifications!: boolean;

  @ApiProperty()
  smsNotifications!: boolean;

  @ApiProperty()
  marketingEmails!: boolean;
}

export class PrivacySettingsResponse {
  @ApiProperty({ enum: ProfileVisibility })
  profileVisibility!: ProfileVisibility;

  @ApiProperty()
  showEmail!: boolean;

  @ApiProperty()
  allowSearchIndexing!: boolean;
}

export class AvatarResponse {
  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}

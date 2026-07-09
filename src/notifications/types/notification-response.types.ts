import { ApiProperty } from '@nestjs/swagger';
import {
  DeliveryStatus,
  NotificationChannel,
  NotificationType,
  PushPlatform,
} from '@prisma/client';

export class NotificationResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ nullable: true })
  templateKey!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedNotificationsResponse {
  @ApiProperty({ type: [NotificationResponse] })
  data!: NotificationResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  unreadCount!: number;
}

export class PreferencesResponse {
  @ApiProperty()
  emailNotifications!: boolean;

  @ApiProperty()
  pushNotifications!: boolean;

  @ApiProperty()
  inAppNotifications!: boolean;

  @ApiProperty()
  smsNotifications!: boolean;

  @ApiProperty()
  marketingEmails!: boolean;
}

export class PushTokenResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PushPlatform })
  platform!: PushPlatform;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class TemplateResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  emailSubject!: string | null;

  @ApiProperty({ nullable: true })
  emailBody!: string | null;

  @ApiProperty({ nullable: true })
  pushTitle!: string | null;

  @ApiProperty({ nullable: true })
  pushBody!: string | null;

  @ApiProperty({ nullable: true })
  inAppBody!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class DeliveryResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationChannel })
  channel!: NotificationChannel;

  @ApiProperty({ enum: DeliveryStatus })
  status!: DeliveryStatus;

  @ApiProperty({ nullable: true })
  error!: string | null;

  @ApiProperty({ nullable: true })
  sentAt!: Date | null;
}

export class MessageResponse {
  @ApiProperty()
  message!: string;
}

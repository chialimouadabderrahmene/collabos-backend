import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class NotificationResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

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

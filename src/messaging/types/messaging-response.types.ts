import { ApiProperty } from '@nestjs/swagger';

export class ParticipantResponse {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  joinedAt!: Date;

  @ApiProperty({ nullable: true })
  lastReadAt!: Date | null;

  @ApiProperty()
  isOnline!: boolean;
}

export class ConversationResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  contextType!: string | null;

  @ApiProperty({ nullable: true })
  contextId!: string | null;

  @ApiProperty({ nullable: true })
  lastMessageAt!: Date | null;

  @ApiProperty({ type: [ParticipantResponse] })
  participants!: ParticipantResponse[];

  @ApiProperty()
  unreadCount!: number;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedConversationsResponse {
  @ApiProperty({ type: [ConversationResponse] })
  data!: ConversationResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class AttachmentResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;
}

export class MessageResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty({ nullable: true })
  body!: string | null;

  @ApiProperty({ type: [AttachmentResponse] })
  attachments!: AttachmentResponse[];

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedMessagesResponse {
  @ApiProperty({ type: [MessageResponse] })
  data!: MessageResponse[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class SeenResponse {
  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  seenAt!: Date;
}

import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListMessagesQueryDto } from '../dto/list-messages-query.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { toMessageResponse } from '../mappers/message.mapper';
import {
  MessageResponse,
  PaginatedMessagesResponse,
} from '../types/messaging-response.types';
import { AttachmentStorageService } from './attachment-storage.service';
import { ConversationsService } from './conversations.service';

const MESSAGE_INCLUDE = { attachments: true } as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationsService: ConversationsService,
    private readonly attachmentStorage: AttachmentStorageService,
  ) {}

  async create(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
    file?: Express.Multer.File,
  ): Promise<MessageResponse> {
    await this.conversationsService.assertParticipantById(
      conversationId,
      senderId,
    );

    const body = dto.body?.trim() || undefined;

    if (!body && !file) {
      throw new BadRequestException(
        'A message requires a body or an attachment',
      );
    }

    if (file && file.size > this.attachmentStorage.getMaxSizeBytes()) {
      throw new PayloadTooLargeException(
        `Attachment must be smaller than ${
          this.attachmentStorage.getMaxSizeBytes() / (1024 * 1024)
        }MB`,
      );
    }

    const stored = file ? await this.attachmentStorage.save(file) : undefined;

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        body,
        attachments: stored
          ? {
              create: [
                {
                  url: stored.url,
                  fileName: stored.fileName,
                  mimeType: stored.mimeType,
                  sizeBytes: stored.sizeBytes,
                },
              ],
            }
          : undefined,
      },
      include: MESSAGE_INCLUDE,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });

    return toMessageResponse(message);
  }

  async findAll(
    conversationId: string,
    userId: string,
    query: ListMessagesQueryDto,
  ): Promise<PaginatedMessagesResponse> {
    await this.conversationsService.assertParticipantById(
      conversationId,
      userId,
    );

    const where = { conversationId };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        include: MESSAGE_INCLUDE,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      data: data.map((message) => toMessageResponse(message)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}

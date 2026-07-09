import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Conversation, ConversationParticipant, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { ListConversationsQueryDto } from '../dto/list-conversations-query.dto';
import {
  ConversationResponse,
  PaginatedConversationsResponse,
  SeenResponse,
} from '../types/messaging-response.types';
import { PresenceService } from './presence.service';

type ConversationWithParticipants = Conversation & {
  participants: ConversationParticipant[];
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
  ) {}

  async create(
    userId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationResponse> {
    const otherParticipantIds = Array.from(new Set(dto.participantIds)).filter(
      (id) => id !== userId,
    );

    if (otherParticipantIds.length === 0) {
      throw new BadRequestException(
        'A conversation requires at least one other participant',
      );
    }

    const participantIds = [userId, ...otherParticipantIds];

    if (participantIds.length === 2) {
      const existing = await this.findExistingDirectConversation(
        participantIds[0],
        participantIds[1],
      );
      if (existing) {
        return this.toResponse(existing, userId);
      }
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        contextType: dto.contextType,
        contextId: dto.contextId,
        participants: {
          create: participantIds.map((participantId) => ({
            userId: participantId,
          })),
        },
      },
      include: { participants: true },
    });

    return this.toResponse(conversation, userId);
  }

  async findAll(
    userId: string,
    query: ListConversationsQueryDto,
  ): Promise<PaginatedConversationsResponse> {
    const where: Prisma.ConversationWhereInput = {
      participants: { some: { userId } },
    };

    const [conversations, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        include: { participants: true },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    const data = await Promise.all(
      conversations.map((conversation) =>
        this.toResponse(conversation, userId),
      ),
    );

    return { data, total, page: query.page, limit: query.limit };
  }

  async findOneOrThrow(
    id: string,
    userId: string,
  ): Promise<ConversationResponse> {
    const conversation = await this.findEntityOrThrow(id);
    this.assertParticipant(conversation, userId);

    return this.toResponse(conversation, userId);
  }

  async markSeen(id: string, userId: string): Promise<SeenResponse> {
    const conversation = await this.findEntityOrThrow(id);
    this.assertParticipant(conversation, userId);

    const seenAt = new Date();
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId } },
      data: { lastReadAt: seenAt },
    });

    return { conversationId: id, userId, seenAt };
  }

  async listConversationIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    return rows.map((row) => row.conversationId);
  }

  async assertParticipantById(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await this.findEntityOrThrow(conversationId);
    this.assertParticipant(conversation, userId);
  }

  private async findExistingDirectConversation(
    userIdA: string,
    userIdB: string,
  ): Promise<ConversationWithParticipants | null> {
    const candidates = await this.prisma.conversation.findMany({
      where: {
        AND: [
          { participants: { some: { userId: userIdA } } },
          { participants: { some: { userId: userIdB } } },
        ],
      },
      include: { participants: true },
    });

    return (
      candidates.find(
        (conversation) => conversation.participants.length === 2,
      ) ?? null
    );
  }

  private async findEntityOrThrow(
    id: string,
  ): Promise<ConversationWithParticipants> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  private assertParticipant(
    conversation: ConversationWithParticipants,
    userId: string,
  ): void {
    const isParticipant = conversation.participants.some(
      (participant) => participant.userId === userId,
    );

    if (!isParticipant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }
  }

  private async toResponse(
    conversation: ConversationWithParticipants,
    requestingUserId: string,
  ): Promise<ConversationResponse> {
    const onlineMap = await this.presenceService.areOnline(
      conversation.participants.map((participant) => participant.userId),
    );

    const requester = conversation.participants.find(
      (participant) => participant.userId === requestingUserId,
    );

    const unreadCount = requester
      ? await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: requestingUserId },
            createdAt: requester.lastReadAt
              ? { gt: requester.lastReadAt }
              : undefined,
          },
        })
      : 0;

    return {
      id: conversation.id,
      contextType: conversation.contextType,
      contextId: conversation.contextId,
      lastMessageAt: conversation.lastMessageAt,
      participants: conversation.participants.map((participant) => ({
        userId: participant.userId,
        joinedAt: participant.joinedAt,
        lastReadAt: participant.lastReadAt,
        isOnline: onlineMap.get(participant.userId) ?? false,
      })),
      unreadCount,
      createdAt: conversation.createdAt,
    };
  }
}

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsService } from './conversations.service';
import { PresenceService } from './presence.service';

function buildConversation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'conversation-1',
    contextType: null,
    contextId: null,
    lastMessageAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    participants: [
      { userId: 'user-1', joinedAt: new Date(), lastReadAt: null },
      { userId: 'user-2', joinedAt: new Date(), lastReadAt: null },
    ],
    ...overrides,
  };
}

describe('ConversationsService', () => {
  let prisma: {
    conversation: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    conversationParticipant: {
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    message: { count: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let presenceService: { areOnline: ReturnType<typeof vi.fn> };
  let service: ConversationsService;

  beforeEach(() => {
    prisma = {
      conversation: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      conversationParticipant: { findMany: vi.fn(), update: vi.fn() },
      message: { count: vi.fn() },
      $transaction: vi.fn(),
    };
    presenceService = { areOnline: vi.fn().mockResolvedValue(new Map()) };
    service = new ConversationsService(
      prisma as unknown as PrismaService,
      presenceService as unknown as PresenceService,
    );
  });

  describe('create', () => {
    it('rejects a conversation with no other participants', async () => {
      await expect(
        service.create('user-1', { participantIds: ['user-1'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns an existing 1:1 conversation instead of creating a duplicate', async () => {
      prisma.conversation.findMany.mockResolvedValue([buildConversation()]);
      prisma.message.count.mockResolvedValue(0);

      const result = await service.create('user-1', {
        participantIds: ['user-2'],
      });

      expect(result.id).toBe('conversation-1');
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('creates a new conversation when none exists', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.conversation.create.mockResolvedValue(buildConversation());
      prisma.message.count.mockResolvedValue(0);

      const result = await service.create('user-1', {
        participantIds: ['user-2'],
      });

      expect(prisma.conversation.create).toHaveBeenCalled();
      expect(result.participants).toHaveLength(2);
    });
  });

  describe('findOneOrThrow', () => {
    it('throws NotFoundException for a missing conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.findOneOrThrow('missing', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException for a non-participant', async () => {
      prisma.conversation.findUnique.mockResolvedValue(buildConversation());

      await expect(
        service.findOneOrThrow('conversation-1', 'stranger'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns the conversation for a participant', async () => {
      prisma.conversation.findUnique.mockResolvedValue(buildConversation());
      prisma.message.count.mockResolvedValue(2);

      const result = await service.findOneOrThrow('conversation-1', 'user-1');

      expect(result.unreadCount).toBe(2);
    });
  });

  describe('markSeen', () => {
    it('updates the participant lastReadAt and returns the seen payload', async () => {
      prisma.conversation.findUnique.mockResolvedValue(buildConversation());
      prisma.conversationParticipant.update.mockResolvedValue({});

      const result = await service.markSeen('conversation-1', 'user-1');

      const updateArgs = prisma.conversationParticipant.update.mock
        .calls[0][0] as {
        where: {
          conversationId_userId: { conversationId: string; userId: string };
        };
        data: { lastReadAt: Date };
      };
      expect(updateArgs.where.conversationId_userId).toEqual({
        conversationId: 'conversation-1',
        userId: 'user-1',
      });
      expect(updateArgs.data.lastReadAt).toBeInstanceOf(Date);
      expect(result.userId).toBe('user-1');
    });

    it('rejects a non-participant', async () => {
      prisma.conversation.findUnique.mockResolvedValue(buildConversation());

      await expect(
        service.markSeen('conversation-1', 'stranger'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

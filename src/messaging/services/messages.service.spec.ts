import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentStorageService } from './attachment-storage.service';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';

function buildMessage(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    senderId: 'user-1',
    body: 'Hello there',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    attachments: [],
    ...overrides,
  };
}

describe('MessagesService', () => {
  let prisma: {
    message: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    conversation: { update: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let conversationsService: { assertParticipantById: ReturnType<typeof vi.fn> };
  let attachmentStorage: {
    save: ReturnType<typeof vi.fn>;
    getMaxSizeBytes: ReturnType<typeof vi.fn>;
  };
  let service: MessagesService;

  beforeEach(() => {
    prisma = {
      message: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      conversation: { update: vi.fn() },
      $transaction: vi.fn(),
    };
    conversationsService = {
      assertParticipantById: vi.fn().mockResolvedValue(undefined),
    };
    attachmentStorage = {
      save: vi.fn(),
      getMaxSizeBytes: vi.fn().mockReturnValue(10 * 1024 * 1024),
    };
    service = new MessagesService(
      prisma as unknown as PrismaService,
      conversationsService as unknown as ConversationsService,
      attachmentStorage as unknown as AttachmentStorageService,
    );
  });

  describe('create', () => {
    it('checks the sender is a participant before anything else', async () => {
      conversationsService.assertParticipantById.mockRejectedValue(
        new Error('not a participant'),
      );

      await expect(
        service.create('conversation-1', 'user-1', { body: 'hi' }),
      ).rejects.toThrow('not a participant');
    });

    it('rejects a message with neither body nor attachment', async () => {
      await expect(
        service.create('conversation-1', 'user-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an attachment larger than the configured limit', async () => {
      const file = { size: 20 * 1024 * 1024 } as Express.Multer.File;

      await expect(
        service.create('conversation-1', 'user-1', {}, file),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('creates a text message and bumps the conversation lastMessageAt', async () => {
      prisma.message.create.mockResolvedValue(buildMessage());

      const result = await service.create('conversation-1', 'user-1', {
        body: 'Hello there',
      });

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conversation-1' },
        data: { lastMessageAt: buildMessage().createdAt },
      });
      expect(result.body).toBe('Hello there');
    });

    it('stores an attachment when a file is provided', async () => {
      const file = { size: 1024, mimetype: 'image/png' } as Express.Multer.File;
      attachmentStorage.save.mockResolvedValue({
        url: '/uploads/messages/file.png',
        fileName: 'file.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      });
      prisma.message.create.mockResolvedValue(
        buildMessage({
          body: null,
          attachments: [
            {
              id: 'attachment-1',
              url: '/uploads/messages/file.png',
              fileName: 'file.png',
              mimeType: 'image/png',
              sizeBytes: 1024,
            },
          ],
        }),
      );

      const result = await service.create('conversation-1', 'user-1', {}, file);

      expect(attachmentStorage.save).toHaveBeenCalledWith(file);
      expect(result.attachments).toHaveLength(1);
    });
  });

  describe('findAll', () => {
    it('asserts participation before listing messages', async () => {
      prisma.$transaction.mockResolvedValue([[buildMessage()], 1]);

      const result = await service.findAll('conversation-1', 'user-1', {
        page: 1,
        limit: 30,
      });

      expect(conversationsService.assertParticipantById).toHaveBeenCalledWith(
        'conversation-1',
        'user-1',
      );
      expect(result.total).toBe(1);
    });
  });
});

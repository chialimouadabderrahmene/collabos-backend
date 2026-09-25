import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveDraftDto } from '../dto/opportunity.dto';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityDocumentService } from './opportunity-document.service';
import { OpportunityDraftService } from './opportunity-draft.service';

const ASSET_ID = '11111111-1111-4111-8111-111111111111';

const user: AuthenticatedUser = {
  id: 'editor-1',
  email: 'editor@brand.com',
  isEmailVerified: true,
  isActive: true,
  roles: ['USER'],
  permissions: [],
};

function buildDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    opportunityId: 'opp-1',
    format: 'tiptap',
    schemaVersion: 1,
    content: { type: 'doc', content: [] },
    revision: 3,
    updatedById: 'editor-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function saveDto(overrides: Partial<SaveDraftDto> = {}): SaveDraftDto {
  return {
    format: 'tiptap',
    schemaVersion: 1,
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
    },
    baseRevision: 3,
    ...overrides,
  };
}

describe('OpportunityDraftService', () => {
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    opportunity: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    opportunityDraft: {
      findUnique: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    opportunityVersion: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    opportunityAsset: { findMany: ReturnType<typeof vi.fn> };
  };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let service: OpportunityDraftService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
      opportunity: {
        findUnique: vi.fn().mockResolvedValue({ latestVersionNumber: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      opportunityDraft: {
        findUnique: vi.fn().mockResolvedValue(buildDraft()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      opportunityVersion: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      opportunityAsset: { findMany: vi.fn().mockResolvedValue([]) },
    };
    access = { authorize: vi.fn().mockResolvedValue({}) };
    service = new OpportunityDraftService(
      prisma as unknown as PrismaService,
      access as unknown as OpportunityAccessService,
      new OpportunityDocumentService(),
    );
  });

  describe('get', () => {
    it('requires VIEW and returns the draft with its revision', async () => {
      const draft = await service.get('opp-1', user);

      expect(access.authorize).toHaveBeenCalledWith(
        'opp-1',
        user,
        OpportunityAction.VIEW,
      );
      expect(draft).toMatchObject({ revision: 3, format: 'tiptap' });
    });

    it('reports unpublished changes against the latest version draft revision', async () => {
      prisma.opportunity.findUnique.mockResolvedValue({
        latestVersionNumber: 2,
      });
      prisma.opportunityVersion.findUnique.mockResolvedValue({
        draftRevision: 3,
      });

      expect((await service.get('opp-1', user)).hasUnpublishedChanges).toBe(
        false,
      );

      prisma.opportunityVersion.findUnique.mockResolvedValue({
        draftRevision: 2,
      });
      expect((await service.get('opp-1', user)).hasUnpublishedChanges).toBe(
        true,
      );
    });
  });

  describe('save', () => {
    it('requires EDIT and increments the revision when baseRevision matches', async () => {
      await service.save('opp-1', user, saveDto());

      expect(access.authorize).toHaveBeenCalledWith(
        'opp-1',
        user,
        OpportunityAction.EDIT,
      );
      expect(prisma.opportunityDraft.updateMany).toHaveBeenCalledWith({
        where: { opportunityId: 'opp-1', revision: 3 },
        data: expect.objectContaining({
          format: 'tiptap',
          revision: { increment: 1 },
          updatedById: 'editor-1',
        }) as unknown,
      });
    });

    it('never touches published versions', async () => {
      await service.save('opp-1', user, saveDto());

      expect(prisma.opportunityVersion.update).not.toHaveBeenCalled();
      expect(prisma.opportunityVersion.updateMany).not.toHaveBeenCalled();
    });

    it('returns 409 with the current revision when the draft moved on', async () => {
      prisma.opportunityDraft.updateMany.mockResolvedValue({ count: 0 });
      prisma.opportunityDraft.findUnique.mockResolvedValue(
        buildDraft({ revision: 5 }),
      );

      const error = await service
        .save('opp-1', user, saveDto())
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        currentRevision: 5,
      });
    });

    it('rejects invalid structured JSON with 400 before touching the database', async () => {
      await expect(
        service.save(
          'opp-1',
          user,
          saveDto({
            content: {
              type: 'doc',
              content: [
                { type: 'link', attrs: { href: 'javascript:alert(1)' } },
              ],
            },
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects references to assets that do not belong to this opportunity', async () => {
      prisma.opportunityAsset.findMany.mockResolvedValue([]);

      await expect(
        service.save(
          'opp-1',
          user,
          saveDto({
            content: {
              type: 'doc',
              content: [{ type: 'image', attrs: { src: `asset:${ASSET_ID}` } }],
            },
          }),
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.opportunityAsset.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [ASSET_ID] },
          opportunityId: 'opp-1',
          deletedAt: null,
        },
      });
      expect(prisma.opportunityDraft.updateMany).not.toHaveBeenCalled();
    });

    it('propagates authorization failures (viewer cannot save)', async () => {
      access.authorize.mockRejectedValue(new ForbiddenException());

      await expect(
        service.save('opp-1', user, saveDto()),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.opportunityDraft.updateMany).not.toHaveBeenCalled();
    });
  });
});

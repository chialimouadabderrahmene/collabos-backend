import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicService } from '../../ai/services/anthropic.service';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';
import { OpportunityAiService } from './opportunity-ai.service';

const user: AuthenticatedUser = {
  id: 'editor-1',
  email: 'editor@brand.com',
  isEmailVerified: true,
  isActive: true,
  roles: ['USER'],
  permissions: [],
};

const DRAFT_CONTENT = {
  type: 'doc',
  content: [{ type: 'text', text: 'Founder original words' }],
};

describe('OpportunityAiService', () => {
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    opportunityDraft: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    opportunity: { update: ReturnType<typeof vi.fn> };
    opportunityAsset: { groupBy: ReturnType<typeof vi.fn> };
    opportunityAiSuggestion: {
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    opportunityActivity: { create: ReturnType<typeof vi.fn> };
  };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let anthropic: {
    isConfigured: ReturnType<typeof vi.fn>;
    completeStructured: ReturnType<typeof vi.fn>;
    getModel: ReturnType<typeof vi.fn>;
  };
  let service: OpportunityAiService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
      opportunityDraft: {
        findUnique: vi.fn().mockResolvedValue({ content: DRAFT_CONTENT }),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      opportunity: { update: vi.fn() },
      opportunityAsset: {
        groupBy: vi
          .fn()
          .mockResolvedValue([{ kind: 'SKETCH', _count: { _all: 2 } }]),
      },
      opportunityAiSuggestion: {
        create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'suggestion-1',
            status: 'PENDING',
            createdAt: new Date(),
            resolvedAt: null,
            ...data,
          }),
        ),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn(),
      },
      opportunityActivity: { create: vi.fn().mockResolvedValue({}) },
    };
    access = {
      authorize: vi.fn().mockResolvedValue({
        opportunity: {
          id: 'opp-1',
          title: 'AW27 Knitwear',
          summary: null,
          metadata: { season: 'AW27' },
        },
      }),
    };
    anthropic = {
      isConfigured: vi.fn().mockReturnValue(true),
      completeStructured: vi.fn().mockResolvedValue({
        title: 'The Quiet Knit',
        summary: 'An invitation to Italian knitwear ateliers.',
        sections: [{ heading: 'The concept', body: 'Soft structure.' }],
      }),
      getModel: vi.fn().mockReturnValue('claude-test'),
    };

    service = new OpportunityAiService(
      prisma as unknown as PrismaService,
      access as unknown as OpportunityAccessService,
      new OpportunityActivityService(
        prisma as unknown as PrismaService,
        access as unknown as OpportunityAccessService,
      ),
      anthropic as unknown as AnthropicService,
      { get: vi.fn().mockReturnValue(2048) } as unknown as ConfigService,
    );
  });

  it('generates and stores a PENDING suggestion', async () => {
    const suggestion = await service.generateCopy('opp-1', user, {
      instructions: 'Knitwear capsule with an Italian atelier',
      tone: 'quiet luxury',
    });

    expect(access.authorize).toHaveBeenCalledWith(
      'opp-1',
      user,
      OpportunityAction.EDIT,
    );
    expect(suggestion).toMatchObject({
      id: 'suggestion-1',
      kind: 'GENERATE_COPY',
      status: 'PENDING',
      model: 'claude-test',
      output: { title: 'The Quiet Knit' },
    });
    const call = anthropic.completeStructured.mock.calls[0][0] as {
      prompt: string;
      tool: { name: string };
    };
    expect(call.tool.name).toBe('propose_opportunity_copy');
    expect(call.prompt).toContain('<founder_input>');
    expect(call.prompt).toContain('Founder original words');
    expect(call.prompt).toContain('2 sketch');
  });

  it('never writes to the draft or the opportunity (no silent overwrite)', async () => {
    await service.generateCopy('opp-1', user, { instructions: 'x' });
    await service.accept('opp-1', 'suggestion-1', user).catch(() => undefined);

    expect(prisma.opportunityDraft.update).not.toHaveBeenCalled();
    expect(prisma.opportunityDraft.updateMany).not.toHaveBeenCalled();
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it('requires edit rights', async () => {
    access.authorize.mockRejectedValue(new ForbiddenException());

    await expect(service.summarize('opp-1', user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(anthropic.completeStructured).not.toHaveBeenCalled();
  });

  it('returns 503 when AI is not configured instead of a fake answer', async () => {
    anthropic.isConfigured.mockReturnValue(false);

    await expect(service.titles('opp-1', user)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.opportunityAiSuggestion.create).not.toHaveBeenCalled();
  });

  it('returns 502 and stores nothing when the model output is invalid', async () => {
    anthropic.completeStructured.mockResolvedValue({ unexpected: true });

    await expect(
      service.rewrite('opp-1', user, { text: 'Make this better' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.opportunityAiSuggestion.create).not.toHaveBeenCalled();
  });

  it('returns 502 when the provider call fails', async () => {
    anthropic.completeStructured.mockRejectedValue(new Error('timeout'));

    await expect(
      service.structure('opp-1', user, { notes: 'Notes' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('accept only records the decision on a pending suggestion', async () => {
    prisma.opportunityAiSuggestion.findFirst.mockResolvedValue({
      id: 'suggestion-1',
      status: 'ACCEPTED',
      kind: 'SUMMARIZE',
      output: {},
      model: 'claude-test',
      requestedById: 'editor-1',
      createdAt: new Date(),
      resolvedAt: new Date(),
    });

    const result = await service.accept('opp-1', 'suggestion-1', user);

    expect(prisma.opportunityAiSuggestion.updateMany).toHaveBeenCalledWith({
      where: { id: 'suggestion-1', opportunityId: 'opp-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'ACCEPTED' }) as unknown,
    });
    expect(result.status).toBe('ACCEPTED');
  });

  it('refuses to accept a suggestion that was already discarded', async () => {
    prisma.opportunityAiSuggestion.updateMany.mockResolvedValue({ count: 0 });
    prisma.opportunityAiSuggestion.findFirst.mockResolvedValue({
      id: 'suggestion-1',
      status: 'DISCARDED',
    });

    await expect(
      service.accept('opp-1', 'suggestion-1', user),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

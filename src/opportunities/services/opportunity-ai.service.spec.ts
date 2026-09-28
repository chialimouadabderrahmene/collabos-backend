import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiClient } from '../../ai/interfaces/ai-client.interface';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_TOOLS } from '../ai/opportunity-ai-tasks';
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
    opportunityAsset: {
      groupBy: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    brand: { findUnique: ReturnType<typeof vi.fn> };
    opportunityAiSuggestion: {
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    opportunityActivity: { create: ReturnType<typeof vi.fn> };
  };
  let access: { authorize: ReturnType<typeof vi.fn> };
  let ai: {
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
        findMany: vi.fn().mockResolvedValue([]),
      },
      brand: {
        findUnique: vi.fn().mockResolvedValue({
          name: 'Void Studio',
          profile: {
            description: 'Quiet-luxury knitwear atelier.',
            location: 'Milan',
            foundedYear: 2019,
          },
        }),
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
          brandId: 'brand-1',
          title: 'AW27 Knitwear',
          summary: null,
          metadata: { season: 'AW27' },
          latestVersionNumber: 0,
          lastPublishedAt: null,
        },
      }),
    };
    ai = {
      isConfigured: vi.fn().mockReturnValue(true),
      completeStructured: vi.fn().mockResolvedValue({
        title: 'The Quiet Knit',
        summary: 'An invitation to Italian knitwear ateliers.',
        sections: [{ heading: 'The concept', body: 'Soft structure.' }],
      }),
      getModel: vi.fn().mockReturnValue('claude-test'),
    };

    // Constructed against the AiClient abstraction, not a concrete
    // provider — this mock is equally valid whether AI_PROVIDER resolves
    // to Anthropic or CodeCraft in production; OpportunityAiService cannot
    // tell the difference.
    service = new OpportunityAiService(
      prisma as unknown as PrismaService,
      access as unknown as OpportunityAccessService,
      new OpportunityActivityService(
        prisma as unknown as PrismaService,
        access as unknown as OpportunityAccessService,
      ),
      ai as unknown as AiClient,
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
    const call = ai.completeStructured.mock.calls[0][0] as {
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

  it('R1: STRUCTURE sees the founder intent already on file but never rewrites it', async () => {
    access.authorize.mockResolvedValue({
      opportunity: {
        id: 'opp-1',
        brandId: 'brand-1',
        title: 'AW27 Knitwear',
        summary: null,
        metadata: {
          specVersion: 1,
          spec: {
            intent: 'Original founder reasoning: explore a summer campaign',
          },
        },
        latestVersionNumber: 0,
        lastPublishedAt: null,
      },
    });
    ai.completeStructured.mockResolvedValue({
      title: 'The Quiet Knit',
      summary: 'An invitation to Italian knitwear ateliers.',
      blocks: [{ type: 'paragraph', text: 'Soft structure.' }],
    });

    await service.structure('opp-1', user, {
      notes: 'Bullet points from a call',
    });

    // The stored intent reached the model as context...
    const call = ai.completeStructured.mock.calls[0][0] as {
      prompt: string;
    };
    expect(call.prompt).toContain(
      'Original founder reasoning: explore a summer campaign',
    );
    // ...but STRUCTURE only ever produces a suggestion; it never writes back
    // to the opportunity, so the founder's original intent cannot be
    // silently overwritten by an AI operation.
    expect(prisma.opportunity.update).not.toHaveBeenCalled();
  });

  it('R4: includes the full R1 specification as labeled fields, not a raw JSON dump', async () => {
    access.authorize.mockResolvedValue({
      opportunity: {
        id: 'opp-1',
        brandId: 'brand-1',
        title: 'AW27 Knitwear',
        summary: null,
        metadata: {
          specVersion: 1,
          spec: {
            intent: 'Explore a summer campaign',
            collaborator: { type: 'Photographer', notes: 'Milan-based' },
            objective: 'Produce a lookbook',
            deliverables: ['10 photos', '3 reels'],
            timeline: 'Drop in July',
            budget: '€5,000',
            constraints: 'Milan-based atelier only',
            successCriteria: '500 waitlist signups',
          },
        },
        latestVersionNumber: 0,
        lastPublishedAt: null,
      },
    });

    await service.summarize('opp-1', user);

    const call = ai.completeStructured.mock.calls[0][0] as { prompt: string };
    expect(call.prompt).toContain('Specification:');
    expect(call.prompt).toContain('Objective: Produce a lookbook');
    expect(call.prompt).toContain('Deliverables: 10 photos, 3 reels');
    expect(call.prompt).toContain('Budget: €5,000');
    // No longer a raw metadata dump.
    expect(call.prompt).not.toContain('"specVersion"');
  });

  it('R4: an empty or absent spec adds nothing (no "Specification:" section)', async () => {
    await service.summarize('opp-1', user);

    const call = ai.completeStructured.mock.calls[0][0] as { prompt: string };
    expect(call.prompt).not.toContain('Specification:');
  });

  it('R4: includes brand context (name, description, location) without contact details', async () => {
    await service.summarize('opp-1', user);

    const call = ai.completeStructured.mock.calls[0][0] as { prompt: string };
    expect(call.prompt).toContain('Brand: Void Studio');
    expect(call.prompt).toContain('Quiet-luxury knitwear atelier.');
    expect(call.prompt).toContain('Based in Milan');
    expect(call.prompt).toContain('Founded 2019');
  });

  it('R4: includes asset alt-text descriptions already on file, never the images themselves', async () => {
    prisma.opportunityAsset.findMany.mockResolvedValue([
      { altText: 'Model wearing beach-ready knit set on the shoreline' },
      { altText: null },
    ]);

    await service.summarize('opp-1', user);

    const call = ai.completeStructured.mock.calls[0][0] as { prompt: string };
    expect(call.prompt).toContain('Asset descriptions:');
    expect(call.prompt).toContain(
      'Model wearing beach-ready knit set on the shoreline',
    );
  });

  it('R4: mentions a prior publish when one exists, using already-loaded version fields', async () => {
    access.authorize.mockResolvedValue({
      opportunity: {
        id: 'opp-1',
        brandId: 'brand-1',
        title: 'AW27 Knitwear',
        summary: null,
        metadata: {},
        latestVersionNumber: 2,
        lastPublishedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    await service.summarize('opp-1', user);

    const call = ai.completeStructured.mock.calls[0][0] as { prompt: string };
    expect(call.prompt).toContain('Previously published: version 2');
    expect(call.prompt).toContain('2026-09-01');
  });

  it('R4: richer context never changes the task instructions or tool schema', async () => {
    ai.completeStructured.mockResolvedValue({
      titles: ['A', 'B', 'C'],
      summaries: ['One line.'],
    });

    await service.titles('opp-1', user);

    const call = ai.completeStructured.mock.calls[0][0] as {
      tool: { name: string };
    };
    expect(call.tool.name).toBe(AI_TOOLS.TITLES.name);
  });

  it('requires edit rights', async () => {
    access.authorize.mockRejectedValue(new ForbiddenException());

    await expect(service.summarize('opp-1', user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(ai.completeStructured).not.toHaveBeenCalled();
  });

  it('returns 503 when AI is not configured instead of a fake answer', async () => {
    ai.isConfigured.mockReturnValue(false);

    await expect(service.titles('opp-1', user)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.opportunityAiSuggestion.create).not.toHaveBeenCalled();
  });

  it('returns 502 and stores nothing when the model output is invalid', async () => {
    ai.completeStructured.mockResolvedValue({ unexpected: true });

    await expect(
      service.rewrite('opp-1', user, { text: 'Make this better' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.opportunityAiSuggestion.create).not.toHaveBeenCalled();
  });

  it('returns 502 when the provider call fails', async () => {
    ai.completeStructured.mockRejectedValue(new Error('timeout'));

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

  describe('gaps (R5)', () => {
    function withSpec(spec: Record<string, unknown>) {
      access.authorize.mockResolvedValue({
        opportunity: {
          id: 'opp-1',
          brandId: 'brand-1',
          title: 'AW27 Knitwear',
          summary: null,
          metadata: { specVersion: 1, spec },
          latestVersionNumber: 0,
          lastPublishedAt: null,
        },
      });
    }

    it('a missing objective produces a gap candidate for that field', async () => {
      withSpec({
        intent: 'x',
        collaborator: { type: 'Photographer' },
        deliverables: ['10 photos'],
        timeline: 'July',
        budget: '€5,000',
        constraints: 'Milan only',
        successCriteria: '500 signups',
      });
      ai.completeStructured.mockResolvedValue({
        gaps: [
          {
            key: 'objective',
            question: 'What outcome should this collaboration achieve?',
            reason: 'No objective is currently specified.',
          },
        ],
      });

      const result = await service.gaps('opp-1', user);

      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toMatchObject({ key: 'objective' });
      expect(access.authorize).toHaveBeenCalledWith(
        'opp-1',
        user,
        OpportunityAction.EDIT,
      );
    });

    it('multiple missing fields are all passed to the model and can all come back', async () => {
      withSpec({ intent: 'x' });
      ai.completeStructured.mockResolvedValue({
        gaps: [
          { key: 'objective', question: 'Q1', reason: 'R1' },
          { key: 'timeline', question: 'Q2', reason: 'R2' },
          { key: 'budget', question: 'Q3', reason: 'R3' },
        ],
      });

      const result = await service.gaps('opp-1', user);

      expect(result.gaps.map((g) => g.key)).toEqual([
        'objective',
        'timeline',
        'budget',
      ]);
      const call = ai.completeStructured.mock.calls[0][0] as { prompt: string };
      expect(call.prompt).toContain('Missing specification fields');
      expect(call.prompt).toContain('objective');
      expect(call.prompt).toContain('budget');
    });

    it('a complete spec returns an empty list without calling the AI at all', async () => {
      withSpec({
        intent: 'x',
        collaborator: { type: 'Photographer' },
        objective: 'Produce a lookbook',
        deliverables: ['10 photos'],
        timeline: 'July',
        budget: '€5,000',
        constraints: 'Milan only',
        successCriteria: '500 signups',
      });

      const result = await service.gaps('opp-1', user);

      expect(result).toEqual({ gaps: [] });
      expect(ai.completeStructured).not.toHaveBeenCalled();
    });

    it('whitespace-only deliverables are treated as missing, matching R2', async () => {
      withSpec({
        intent: 'x',
        collaborator: { type: 'Photographer' },
        objective: 'Produce a lookbook',
        deliverables: ['   '],
        timeline: 'July',
        budget: '€5,000',
        constraints: 'Milan only',
        successCriteria: '500 signups',
      });
      ai.completeStructured.mockResolvedValue({
        gaps: [{ key: 'deliverables', question: 'Q', reason: 'R' }],
      });

      const result = await service.gaps('opp-1', user);

      expect(result.gaps.map((g) => g.key)).toEqual(['deliverables']);
    });

    it('R2 remains the source of truth: a proposed key that is not actually missing is dropped', async () => {
      withSpec({
        intent: 'x',
        collaborator: { type: 'Photographer' },
        deliverables: ['10 photos'],
        timeline: 'July',
        budget: '€5,000',
        constraints: 'Milan only',
        successCriteria: '500 signups',
        // objective is the only field genuinely missing
      });
      ai.completeStructured.mockResolvedValue({
        gaps: [
          { key: 'objective', question: 'Real gap', reason: 'Missing.' },
          // The model invents a question about a field that is NOT missing —
          // R2 (not the model) decides what counts, so this must be dropped.
          { key: 'budget', question: 'Invented gap', reason: 'Invented.' },
        ],
      });

      const result = await service.gaps('opp-1', user);

      expect(result.gaps.map((g) => g.key)).toEqual(['objective']);
    });

    it('never writes to the spec, draft or a decision', async () => {
      withSpec({ intent: 'x' });
      ai.completeStructured.mockResolvedValue({
        gaps: [{ key: 'objective', question: 'Q', reason: 'R' }],
      });

      await service.gaps('opp-1', user);

      expect(prisma.opportunity.update).not.toHaveBeenCalled();
      expect(prisma.opportunityDraft.update).not.toHaveBeenCalled();
      expect(prisma.opportunityDraft.updateMany).not.toHaveBeenCalled();
      expect(prisma.opportunityAiSuggestion.create).not.toHaveBeenCalled();
    });

    it('rejects malformed AI output safely instead of returning garbage', async () => {
      withSpec({ intent: 'x' });
      ai.completeStructured.mockResolvedValue({ unexpected: true });

      await expect(service.gaps('opp-1', user)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('rejects a gap with an invalid field key safely', async () => {
      withSpec({ intent: 'x' });
      ai.completeStructured.mockResolvedValue({
        gaps: [{ key: 'not_a_real_field', question: 'Q', reason: 'R' }],
      });

      await expect(service.gaps('opp-1', user)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('returns 503 when AI is not configured, same as every other task', async () => {
      withSpec({ intent: 'x' });
      ai.isConfigured.mockReturnValue(false);

      await expect(service.gaps('opp-1', user)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('never automatically returns more than 5 gaps', async () => {
      withSpec({});
      ai.completeStructured.mockResolvedValue({
        gaps: [
          { key: 'intent', question: 'Q', reason: 'R' },
          { key: 'collaborator', question: 'Q', reason: 'R' },
          { key: 'objective', question: 'Q', reason: 'R' },
          { key: 'deliverables', question: 'Q', reason: 'R' },
          { key: 'timeline', question: 'Q', reason: 'R' },
          { key: 'budget', question: 'Q', reason: 'R' },
          { key: 'constraints', question: 'Q', reason: 'R' },
        ],
      });

      const result = await service.gaps('opp-1', user);

      expect(result.gaps.length).toBeLessThanOrEqual(5);
    });

    it('goes through the same AiClient abstraction as every other task — provider-agnostic (Anthropic or CodeCraft)', async () => {
      withSpec({ intent: 'x' });
      ai.completeStructured.mockResolvedValue({
        gaps: [{ key: 'objective', question: 'Q', reason: 'R' }],
      });

      await service.gaps('opp-1', user);

      // Same injected `ai` mock the rest of the suite proves works for both
      // AnthropicService and CodeCraftService (see ai-provider.factory.spec.ts
      // and codecraft.service.spec.ts) — gaps() never special-cases either.
      expect(ai.completeStructured).toHaveBeenCalledTimes(1);
      expect(ai.isConfigured).toHaveBeenCalled();
    });
  });
});

import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OpportunityActivityType,
  OpportunityAiSuggestionKind,
  OpportunityAiSuggestionStatus,
  Prisma,
} from '@prisma/client';
import { AI_CLIENT } from '../../ai/interfaces/ai-client.interface';
import type { AiClient } from '../../ai/interfaces/ai-client.interface';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AI_OUTPUT_SCHEMAS,
  AI_SYSTEM_PROMPT,
  AI_TASK_INSTRUCTIONS,
  AI_TOOLS,
  GAPS_OUTPUT_SCHEMA,
  GAPS_TASK_INSTRUCTION,
  GAPS_TOOL,
} from '../ai/opportunity-ai-tasks';
import {
  OpportunitySpec,
  opportunitySpecSchema,
} from '../schemas/opportunity-spec.schema';
import { evaluateSpecConfidence } from '../schemas/opportunity-spec-confidence';
import {
  GenerateCopyDto,
  ListAiSuggestionsQueryDto,
  RewriteCopyDto,
  StructureDto,
} from '../dto/ai.dto';
import { toAiSuggestionResponse } from '../mappers/opportunity.mapper';
import {
  AiSuggestionResponse,
  GapsResponse,
  PaginatedAiSuggestionsResponse,
} from '../types/opportunity-response.types';
import { extractPlainText } from '../utils/document.util';
import {
  OpportunityAccessContext,
  OpportunityAccessService,
  OpportunityAction,
} from './opportunity-access.service';
import { OpportunityActivityService } from './opportunity-activity.service';

interface SuggestionRequest {
  kind: OpportunityAiSuggestionKind;
  /** Stored on the suggestion row (the user's own request parameters). */
  input: Prisma.InputJsonObject;
  /** User-supplied material, placed inside <founder_input>. */
  founderInput?: string;
  extraInstruction?: string;
}

/**
 * AI assistance for the studio. Every call produces a stored *suggestion*;
 * nothing here ever writes to the draft, title or summary. The client shows
 * the suggestion, the user accepts/edits it, and the client saves the draft
 * through the normal draft endpoint. `accept`/`discard` only record the
 * decision.
 */
@Injectable()
export class OpportunityAiService {
  private readonly logger = new Logger(OpportunityAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: OpportunityAccessService,
    private readonly activity: OpportunityActivityService,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    private readonly configService: ConfigService,
  ) {}

  generateCopy(
    opportunityId: string,
    user: AuthenticatedUser,
    dto: GenerateCopyDto,
  ): Promise<AiSuggestionResponse> {
    return this.suggest(opportunityId, user, {
      kind: OpportunityAiSuggestionKind.GENERATE_COPY,
      input: { instructions: dto.instructions, tone: dto.tone ?? null },
      founderInput: dto.instructions,
      extraInstruction: dto.tone ? `Tone: ${dto.tone}.` : undefined,
    });
  }

  rewrite(
    opportunityId: string,
    user: AuthenticatedUser,
    dto: RewriteCopyDto,
  ): Promise<AiSuggestionResponse> {
    return this.suggest(opportunityId, user, {
      kind: OpportunityAiSuggestionKind.REWRITE,
      input: {
        text: dto.text,
        instruction: dto.instruction ?? null,
        tone: dto.tone ?? null,
      },
      founderInput: dto.text,
      extraInstruction: [
        dto.instruction ? `Instruction: ${dto.instruction}` : '',
        dto.tone ? `Tone: ${dto.tone}.` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  summarize(
    opportunityId: string,
    user: AuthenticatedUser,
  ): Promise<AiSuggestionResponse> {
    return this.suggest(opportunityId, user, {
      kind: OpportunityAiSuggestionKind.SUMMARIZE,
      input: {},
    });
  }

  structure(
    opportunityId: string,
    user: AuthenticatedUser,
    dto: StructureDto,
  ): Promise<AiSuggestionResponse> {
    return this.suggest(opportunityId, user, {
      kind: OpportunityAiSuggestionKind.STRUCTURE,
      input: { notes: dto.notes },
      founderInput: dto.notes,
    });
  }

  titles(
    opportunityId: string,
    user: AuthenticatedUser,
  ): Promise<AiSuggestionResponse> {
    return this.suggest(opportunityId, user, {
      kind: OpportunityAiSuggestionKind.TITLES,
      input: {},
    });
  }

  async list(
    opportunityId: string,
    user: AuthenticatedUser,
    query: ListAiSuggestionsQueryDto,
  ): Promise<PaginatedAiSuggestionsResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.VIEW);

    const where: Prisma.OpportunityAiSuggestionWhereInput = {
      opportunityId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.opportunityAiSuggestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.opportunityAiSuggestion.count({ where }),
    ]);

    return {
      data: items.map(toAiSuggestionResponse),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /** Records that the user applied the suggestion. Does NOT modify the
   * draft — the client saves the (possibly edited) content itself. */
  accept(
    opportunityId: string,
    suggestionId: string,
    user: AuthenticatedUser,
  ): Promise<AiSuggestionResponse> {
    return this.resolve(
      opportunityId,
      suggestionId,
      user,
      OpportunityAiSuggestionStatus.ACCEPTED,
    );
  }

  discard(
    opportunityId: string,
    suggestionId: string,
    user: AuthenticatedUser,
  ): Promise<AiSuggestionResponse> {
    return this.resolve(
      opportunityId,
      suggestionId,
      user,
      OpportunityAiSuggestionStatus.DISCARDED,
    );
  }

  private async suggest(
    opportunityId: string,
    user: AuthenticatedUser,
    request: SuggestionRequest,
  ): Promise<AiSuggestionResponse> {
    const context = await this.access.authorize(
      opportunityId,
      user,
      OpportunityAction.EDIT,
    );

    if (!this.ai.isConfigured()) {
      throw new ServiceUnavailableException('AI assistance is not configured');
    }

    const prompt = await this.buildPrompt(context, request);
    const tool = AI_TOOLS[request.kind];
    const startedAt = Date.now();

    let raw: unknown;
    try {
      raw = await this.ai.completeStructured({
        system: AI_SYSTEM_PROMPT,
        prompt,
        tool,
        maxTokens: this.configService.get<number>('opportunities.aiMaxTokens'),
      });
    } catch (error) {
      this.logger.warn(
        `AI request failed kind=${request.kind} opportunity=${opportunityId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new BadGatewayException('The AI provider request failed');
    }

    const parsed = AI_OUTPUT_SCHEMAS[request.kind].safeParse(raw);
    if (!parsed.success) {
      this.logger.warn(
        `AI returned invalid output kind=${request.kind} opportunity=${opportunityId}`,
      );
      throw new BadGatewayException('The AI returned an unexpected response');
    }

    const model = this.ai.getModel();
    const suggestion = await this.prisma.$transaction(async (tx) => {
      const created = await tx.opportunityAiSuggestion.create({
        data: {
          opportunityId,
          requestedById: user.id,
          kind: request.kind,
          input: request.input,
          output: parsed.data,
          model,
        },
      });
      await this.activity.record(tx, {
        opportunityId,
        actorId: user.id,
        type: OpportunityActivityType.AI_SUGGESTION_REQUESTED,
        metadata: {
          suggestionId: created.id,
          kind: request.kind,
          model,
          latencyMs: Date.now() - startedAt,
        },
      });
      return created;
    });

    return toAiSuggestionResponse(suggestion);
  }

  private async resolve(
    opportunityId: string,
    suggestionId: string,
    user: AuthenticatedUser,
    status: OpportunityAiSuggestionStatus,
  ): Promise<AiSuggestionResponse> {
    await this.access.authorize(opportunityId, user, OpportunityAction.EDIT);

    const { count } = await this.prisma.opportunityAiSuggestion.updateMany({
      where: {
        id: suggestionId,
        opportunityId,
        status: OpportunityAiSuggestionStatus.PENDING,
      },
      data: { status, resolvedById: user.id, resolvedAt: new Date() },
    });

    const suggestion = await this.prisma.opportunityAiSuggestion.findFirst({
      where: { id: suggestionId, opportunityId },
    });
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }
    if (count === 0 && suggestion.status !== status) {
      throw new ConflictException(
        `Suggestion was already ${suggestion.status.toLowerCase()}`,
      );
    }

    return toAiSuggestionResponse(suggestion);
  }

  /** Shared context-gathering for both the existing suggestion tasks and
   * R5 gaps — pure data fetching, no task-specific wording. */
  private async fetchAiContext(
    opportunityId: string,
    brandId: string,
  ): Promise<{
    draftText: string;
    assets: string;
    assetDescriptions: string[];
    brand: {
      name: string;
      profile: {
        description: string | null;
        location: string | null;
        foundedYear: number | null;
      } | null;
    } | null;
  }> {
    const [draft, assetKinds, describedAssets, brand] = await Promise.all([
      this.prisma.opportunityDraft.findUnique({
        where: { opportunityId },
        select: { content: true },
      }),
      this.prisma.opportunityAsset.groupBy({
        by: ['kind'],
        where: { opportunityId, deletedAt: null },
        _count: { _all: true },
      }),
      // A few real alt-text descriptions give the model something concrete
      // to reference beyond a bare count — never the images themselves (no
      // image understanding), just text the user already wrote.
      this.prisma.opportunityAsset.findMany({
        where: { opportunityId, deletedAt: null, altText: { not: null } },
        select: { altText: true },
        take: 10,
      }),
      this.prisma.brand.findUnique({
        where: { id: brandId },
        select: {
          name: true,
          profile: {
            select: { description: true, location: true, foundedYear: true },
          },
        },
      }),
    ]);

    return {
      draftText: draft ? extractPlainText(draft.content) : '',
      assets: assetKinds
        .map((group) => `${group._count._all} ${group.kind.toLowerCase()}`)
        .join(', '),
      assetDescriptions: describedAssets
        .map((asset) => asset.altText)
        .filter((text): text is string => Boolean(text)),
      brand,
    };
  }

  /** The `<opportunity>...</opportunity>` block shared by every task,
   * including R5 gaps — kept separate from task-specific instructions. */
  private buildOpportunityBlock(
    opportunity: OpportunityAccessContext['opportunity'],
    spec: OpportunitySpec | undefined,
    ctx: Awaited<ReturnType<OpportunityAiService['fetchAiContext']>>,
  ): string[] {
    return [
      '<opportunity>',
      `Title: ${opportunity.title}`,
      opportunity.summary ? `Summary: ${opportunity.summary}` : '',
      ctx.brand ? this.formatBrandContext(ctx.brand) : '',
      spec ? this.formatSpec(spec) : '',
      opportunity.latestVersionNumber > 0
        ? `Previously published: version ${opportunity.latestVersionNumber}${
            opportunity.lastPublishedAt
              ? ` (${opportunity.lastPublishedAt.toISOString().slice(0, 10)})`
              : ''
          }`
        : '',
      ctx.assets ? `Visual assets uploaded: ${ctx.assets}` : '',
      ctx.assetDescriptions.length > 0
        ? `Asset descriptions: ${ctx.assetDescriptions.join('; ')}`
        : '',
      ctx.draftText
        ? `Current draft text: ${ctx.draftText}`
        : 'Current draft: empty',
      '</opportunity>',
    ];
  }

  private readSpec(metadata: unknown): OpportunitySpec | undefined {
    const result = opportunitySpecSchema.safeParse(
      (metadata as Record<string, unknown> | null)?.spec,
    );
    return result.success ? result.data : undefined;
  }

  private async buildPrompt(
    context: OpportunityAccessContext,
    request: SuggestionRequest,
  ): Promise<string> {
    const { opportunity } = context;
    const ctx = await this.fetchAiContext(opportunity.id, opportunity.brandId);
    const spec = this.readSpec(opportunity.metadata);

    const sections = [
      ...this.buildOpportunityBlock(opportunity, spec, ctx),
      request.founderInput
        ? `<founder_input>\n${request.founderInput}\n</founder_input>`
        : '',
      `Task: ${AI_TASK_INSTRUCTIONS[request.kind]}`,
      request.extraInstruction ?? '',
    ];

    return sections.filter(Boolean).join('\n');
  }

  private async buildGapsPrompt(
    context: OpportunityAccessContext,
    spec: OpportunitySpec,
    missing: string[],
  ): Promise<string> {
    const { opportunity } = context;
    const ctx = await this.fetchAiContext(opportunity.id, opportunity.brandId);

    const sections = [
      ...this.buildOpportunityBlock(opportunity, spec, ctx),
      `Missing specification fields (only ask about these — never invent others): ${missing.join(', ')}`,
      `Task: ${GAPS_TASK_INSTRUCTION}`,
    ];

    return sections.filter(Boolean).join('\n');
  }

  /**
   * R5 — CONFIDENCE → "what should I clarify, and why?". R2's deterministic
   * `evaluateSpecConfidence` is the only source of truth for what is
   * missing; the AI never decides that on its own, and its output is
   * filtered back down to exactly that set afterward. Purely informational:
   * nothing here is stored, nothing writes to the spec, draft or a
   * decision.
   */
  async gaps(
    opportunityId: string,
    user: AuthenticatedUser,
  ): Promise<GapsResponse> {
    const context = await this.access.authorize(
      opportunityId,
      user,
      OpportunityAction.EDIT,
    );

    if (!this.ai.isConfigured()) {
      throw new ServiceUnavailableException('AI assistance is not configured');
    }

    const spec = this.readSpec(context.opportunity.metadata) ?? {};
    const { missing } = evaluateSpecConfidence(spec);

    if (missing.length === 0) {
      return { gaps: [] };
    }

    const prompt = await this.buildGapsPrompt(context, spec, missing);

    let raw: unknown;
    try {
      raw = await this.ai.completeStructured({
        system: AI_SYSTEM_PROMPT,
        prompt,
        tool: GAPS_TOOL,
        maxTokens: this.configService.get<number>('opportunities.aiMaxTokens'),
      });
    } catch (error) {
      this.logger.warn(
        `AI gaps request failed opportunity=${opportunityId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new BadGatewayException('The AI provider request failed');
    }

    const parsed = GAPS_OUTPUT_SCHEMA.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn(
        `AI returned invalid gaps output opportunity=${opportunityId}`,
      );
      throw new BadGatewayException('The AI returned an unexpected response');
    }

    // R2 stays the source of truth even after the model answers: any key
    // it proposes that isn't actually in `missing` is dropped, not trusted.
    const missingSet = new Set<string>(missing);
    const gaps = parsed.data.gaps
      .filter((gap) => missingSet.has(gap.key))
      .slice(0, 5);

    return { gaps };
  }

  /** Human-readable brand context — never contact details, just enough for
   * the model to place the opportunity: who the brand is, roughly. */
  private formatBrandContext(brand: {
    name: string;
    profile: {
      description: string | null;
      location: string | null;
      foundedYear: number | null;
    } | null;
  }): string {
    const parts = [
      `Brand: ${brand.name}`,
      brand.profile?.description,
      brand.profile?.location ? `Based in ${brand.profile.location}` : null,
      brand.profile?.foundedYear
        ? `Founded ${brand.profile.foundedYear}`
        : null,
    ].filter(Boolean);
    return parts.join(' — ');
  }

  /** R1's structured spec, rendered as labeled lines rather than a raw JSON
   * dump, so the model reads the same fields the user filled in the Studio
   * Properties panel. Read-only here — AI never writes the spec back. */
  private formatSpec(spec: OpportunitySpec): string {
    const lines = [
      spec.intent ? `Why this exists: ${spec.intent}` : '',
      spec.collaborator?.type ? `Looking for: ${spec.collaborator.type}` : '',
      spec.collaborator?.notes
        ? `What makes them the right fit: ${spec.collaborator.notes}`
        : '',
      spec.objective ? `Objective: ${spec.objective}` : '',
      spec.deliverables?.length
        ? `Deliverables: ${spec.deliverables.join(', ')}`
        : '',
      spec.timeline ? `Timing: ${spec.timeline}` : '',
      spec.budget ? `Budget: ${spec.budget}` : '',
      spec.constraints ? `Constraints: ${spec.constraints}` : '',
      spec.successCriteria ? `Success looks like: ${spec.successCriteria}` : '',
    ].filter(Boolean);
    return lines.length > 0 ? `Specification:\n${lines.join('\n')}` : '';
  }
}

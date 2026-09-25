import {
  BadGatewayException,
  ConflictException,
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
import { AnthropicService } from '../../ai/services/anthropic.service';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AI_OUTPUT_SCHEMAS,
  AI_SYSTEM_PROMPT,
  AI_TASK_INSTRUCTIONS,
  AI_TOOLS,
} from '../ai/opportunity-ai-tasks';
import {
  GenerateCopyDto,
  ListAiSuggestionsQueryDto,
  RewriteCopyDto,
  StructureDto,
} from '../dto/ai.dto';
import { toAiSuggestionResponse } from '../mappers/opportunity.mapper';
import {
  AiSuggestionResponse,
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
    private readonly anthropic: AnthropicService,
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

    if (!this.anthropic.isConfigured()) {
      throw new ServiceUnavailableException('AI assistance is not configured');
    }

    const prompt = await this.buildPrompt(context, request);
    const tool = AI_TOOLS[request.kind];
    const startedAt = Date.now();

    let raw: unknown;
    try {
      raw = await this.anthropic.completeStructured({
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

    const model = this.anthropic.getModel();
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

  private async buildPrompt(
    context: OpportunityAccessContext,
    request: SuggestionRequest,
  ): Promise<string> {
    const { opportunity } = context;
    const [draft, assetKinds] = await Promise.all([
      this.prisma.opportunityDraft.findUnique({
        where: { opportunityId: opportunity.id },
        select: { content: true },
      }),
      this.prisma.opportunityAsset.groupBy({
        by: ['kind'],
        where: { opportunityId: opportunity.id, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const draftText = draft ? extractPlainText(draft.content) : '';
    const assets = assetKinds
      .map((group) => `${group._count._all} ${group.kind.toLowerCase()}`)
      .join(', ');

    const sections = [
      '<opportunity>',
      `Title: ${opportunity.title}`,
      opportunity.summary ? `Summary: ${opportunity.summary}` : '',
      `Metadata: ${JSON.stringify(opportunity.metadata).slice(0, 2000)}`,
      assets ? `Visual assets uploaded: ${assets}` : '',
      draftText ? `Current draft text: ${draftText}` : 'Current draft: empty',
      '</opportunity>',
      request.founderInput
        ? `<founder_input>\n${request.founderInput}\n</founder_input>`
        : '',
      `Task: ${AI_TASK_INSTRUCTIONS[request.kind]}`,
      request.extraInstruction ?? '',
    ];

    return sections.filter(Boolean).join('\n');
  }
}

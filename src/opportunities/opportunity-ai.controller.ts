import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  GenerateCopyDto,
  ListAiSuggestionsQueryDto,
  RewriteCopyDto,
  StructureDto,
} from './dto/ai.dto';
import { OpportunityAiService } from './services/opportunity-ai.service';
import {
  AiSuggestionResponse,
  PaginatedAiSuggestionsResponse,
} from './types/opportunity-response.types';

const AI_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

/**
 * AI assistance. Every generation endpoint returns a *suggestion* that is
 * stored but never applied: the user reviews/edits it in the editor and the
 * client saves the draft through PUT /opportunities/:id/draft.
 */
@ApiTags('opportunities/ai')
@ApiBearerAuth()
@Controller('opportunities/:id/ai')
export class OpportunityAiController {
  constructor(private readonly aiService: OpportunityAiService) {}

  @Post('generate')
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: 'Suggest editorial copy from a founder brief' })
  @ApiResponse({ status: 201, type: AiSuggestionResponse })
  generate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateCopyDto,
  ): Promise<AiSuggestionResponse> {
    return this.aiService.generateCopy(id, user, dto);
  }

  @Post('rewrite')
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: 'Suggest a rewrite of a passage' })
  @ApiResponse({ status: 201, type: AiSuggestionResponse })
  rewrite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RewriteCopyDto,
  ): Promise<AiSuggestionResponse> {
    return this.aiService.rewrite(id, user, dto);
  }

  @Post('summarize')
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: 'Suggest a summary of the concept' })
  @ApiResponse({ status: 201, type: AiSuggestionResponse })
  summarize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AiSuggestionResponse> {
    return this.aiService.summarize(id, user);
  }

  @Post('structure')
  @Throttle(AI_THROTTLE)
  @ApiOperation({
    summary: 'Suggest an editorial structure (blocks) from raw founder notes',
  })
  @ApiResponse({ status: 201, type: AiSuggestionResponse })
  structure(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StructureDto,
  ): Promise<AiSuggestionResponse> {
    return this.aiService.structure(id, user, dto);
  }

  @Post('titles')
  @Throttle(AI_THROTTLE)
  @ApiOperation({ summary: 'Suggest alternative titles and descriptions' })
  @ApiResponse({ status: 201, type: AiSuggestionResponse })
  titles(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AiSuggestionResponse> {
    return this.aiService.titles(id, user);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'List AI suggestions' })
  @ApiResponse({ status: 200, type: PaginatedAiSuggestionsResponse })
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAiSuggestionsQueryDto,
  ): Promise<PaginatedAiSuggestionsResponse> {
    return this.aiService.list(id, user, query);
  }

  @Post('suggestions/:suggestionId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record that a suggestion was applied (does not modify the draft)',
  })
  @ApiResponse({ status: 200, type: AiSuggestionResponse })
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('suggestionId', ParseUUIDPipe) suggestionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AiSuggestionResponse> {
    return this.aiService.accept(id, suggestionId, user);
  }

  @Post('suggestions/:suggestionId/discard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Discard a suggestion' })
  @ApiResponse({ status: 200, type: AiSuggestionResponse })
  discard(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('suggestionId', ParseUUIDPipe) suggestionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AiSuggestionResponse> {
    return this.aiService.discard(id, suggestionId, user);
  }
}

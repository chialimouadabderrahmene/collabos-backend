import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingGateway } from './gateway/messaging.gateway';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import {
  ConversationResponse,
  MessageResponse,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
  SeenResponse,
} from './types/messaging-response.types';

@ApiTags('messaging')
@ApiBearerAuth()
@Controller('messaging')
export class MessagingController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Start (or resume) a conversation' })
  @ApiResponse({ status: 201, type: ConversationResponse })
  createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationResponse> {
    return this.conversationsService.create(user.id, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List my conversations' })
  @ApiResponse({ status: 200, type: PaginatedConversationsResponse })
  findConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListConversationsQueryDto,
  ): Promise<PaginatedConversationsResponse> {
    return this.conversationsService.findAll(user.id, query);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation' })
  @ApiResponse({ status: 200, type: ConversationResponse })
  findConversation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversationResponse> {
    return this.conversationsService.findOneOrThrow(id, user.id);
  }

  @Post('conversations/:id/seen')
  @ApiOperation({ summary: 'Mark a conversation as seen' })
  @ApiResponse({ status: 200, type: SeenResponse })
  async markSeen(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SeenResponse> {
    const seen = await this.conversationsService.markSeen(id, user.id);
    this.messagingGateway.broadcastSeen(seen);
    return seen;
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  @ApiResponse({ status: 200, type: PaginatedMessagesResponse })
  findMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMessagesQueryDto,
  ): Promise<PaginatedMessagesResponse> {
    return this.messagesService.findAll(id, user.id, query);
  }

  @Post('conversations/:id/messages')
  @UseInterceptors(FileInterceptor('attachment'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        attachment: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Send a message, optionally with an attachment' })
  @ApiResponse({ status: 201, type: MessageResponse })
  async sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MessageResponse> {
    const message = await this.messagesService.create(id, user.id, dto, file);
    this.messagingGateway.broadcastNewMessage(id, message);
    return message;
  }
}

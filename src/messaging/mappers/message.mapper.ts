import { Message, MessageAttachment } from '@prisma/client';
import { MessageResponse } from '../types/messaging-response.types';

type MessageWithAttachments = Message & { attachments: MessageAttachment[] };

export function toMessageResponse(
  message: MessageWithAttachments,
): MessageResponse {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      url: attachment.url,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    })),
    createdAt: message.createdAt,
  };
}

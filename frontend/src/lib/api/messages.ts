import { http, type Paginated } from "./http";

export interface Participant {
  userId: string;
  joinedAt: string;
  lastReadAt: string | null;
  isOnline: boolean;
}

export interface Conversation {
  id: string;
  contextType: string | null;
  contextId: string | null;
  lastMessageAt: string | null;
  participants: Participant[];
  unreadCount: number;
  createdAt: string;
}

export interface MessageAttachment {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  attachments: MessageAttachment[];
  createdAt: string;
}

/** Mirrors the backend attachment allow-list. */
export const MESSAGE_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
export const MESSAGE_BODY_MAX = 5000;

export const messagesApi = {
  conversations: (page = 1) =>
    http.get<Paginated<Conversation>>("messaging/conversations", { page, limit: 30 }),
  conversation: (id: string) => http.get<Conversation>(`messaging/conversations/${id}`),
  start: (input: { participantIds: string[]; contextType?: string; contextId?: string }) =>
    http.post<Conversation>("messaging/conversations", input),
  messages: (id: string, page = 1) =>
    http.get<Paginated<Message>>(`messaging/conversations/${id}/messages`, { page, limit: 50 }),
  /** Multipart field name `attachment` is fixed by the backend. */
  send: (id: string, input: { body?: string; attachment?: File }) => {
    if (!input.attachment) {
      return http.post<Message>(`messaging/conversations/${id}/messages`, { body: input.body });
    }
    const form = new FormData();
    if (input.body) form.append("body", input.body);
    form.append("attachment", input.attachment);
    return http.post<Message>(`messaging/conversations/${id}/messages`, form);
  },
  markSeen: (id: string) => http.post<unknown>(`messaging/conversations/${id}/seen`),
};

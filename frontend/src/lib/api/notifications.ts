import { http, type Paginated } from "./http";

export type NotificationType =
  | "APPLICATION_RECEIVED"
  | "APPLICATION_ACCEPTED"
  | "APPLICATION_REJECTED"
  | "APPLICATION_WITHDRAWN"
  | "GENERIC";

export interface AppNotification {
  id: string;
  type: NotificationType;
  templateKey: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (query: { page?: number; limit?: number; unreadOnly?: boolean } = {}) =>
    http.get<Paginated<AppNotification>>("notifications", { ...query }),
  markRead: (id: string) => http.post<AppNotification>(`notifications/${id}/read`),
  markAllRead: () => http.post<{ message: string }>("notifications/read-all"),
};

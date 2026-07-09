import {
  Notification,
  NotificationPreferences,
  NotificationTemplate,
  PushToken,
} from '@prisma/client';
import {
  NotificationResponse,
  PreferencesResponse,
  PushTokenResponse,
  TemplateResponse,
} from '../types/notification-response.types';

export function toNotificationResponse(
  notification: Notification,
): NotificationResponse {
  return {
    id: notification.id,
    type: notification.type,
    templateKey: notification.templateKey,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

export function toPreferencesResponse(
  preferences: NotificationPreferences,
): PreferencesResponse {
  return {
    emailNotifications: preferences.emailNotifications,
    pushNotifications: preferences.pushNotifications,
    inAppNotifications: preferences.inAppNotifications,
    smsNotifications: preferences.smsNotifications,
    marketingEmails: preferences.marketingEmails,
  };
}

export function toPushTokenResponse(pushToken: PushToken): PushTokenResponse {
  return {
    id: pushToken.id,
    platform: pushToken.platform,
    isActive: pushToken.isActive,
    createdAt: pushToken.createdAt,
  };
}

export function toTemplateResponse(
  template: NotificationTemplate,
): TemplateResponse {
  return {
    id: template.id,
    key: template.key,
    name: template.name,
    emailSubject: template.emailSubject,
    emailBody: template.emailBody,
    pushTitle: template.pushTitle,
    pushBody: template.pushBody,
    inAppBody: template.inAppBody,
    isActive: template.isActive,
    createdAt: template.createdAt,
  };
}

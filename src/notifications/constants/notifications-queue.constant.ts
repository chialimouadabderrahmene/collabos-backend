export const NOTIFICATIONS_QUEUE = 'notifications';
export const DELIVER_NOTIFICATION_JOB = 'deliver-notification';

export interface DeliverNotificationJobData {
  deliveryId: string;
}

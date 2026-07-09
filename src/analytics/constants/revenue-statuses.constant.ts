import { OrderStatus } from '@prisma/client';

export const REVENUE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.FULFILLED,
  OrderStatus.COMPLETED,
  OrderStatus.PARTIALLY_REFUNDED,
];

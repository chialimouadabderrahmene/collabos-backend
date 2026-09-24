import { http, type Paginated } from "./http";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "FULFILLED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";
export type RefundStatus = "PENDING" | "APPROVED" | "REJECTED" | "PROCESSED";
export type ShipmentStatus = "PENDING" | "SHIPPED" | "IN_TRANSIT" | "DELIVERED" | "RETURNED";

export interface CartItem {
  id: string;
  variantId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
}

export interface OrderItem {
  id: string;
  variantId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  buyerId: string;
  brandId: string;
  status: OrderStatus;
  subtotal: number;
  currency: string;
  items: OrderItem[];
  cancelledAt: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  rejectedReason: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface Shipment {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  status: ShipmentStatus;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export const CART_MAX_QUANTITY = 999;

export const cartApi = {
  get: () => http.get<Cart>("cart"),
  add: (variantId: string, quantity: number) => http.post<Cart>("cart/items", { variantId, quantity }),
  update: (itemId: string, quantity: number) => http.patch<Cart>(`cart/items/${itemId}`, { quantity }),
  remove: (itemId: string) => http.delete<Cart>(`cart/items/${itemId}`),
  clear: () => http.delete<Cart>("cart"),
};

export const ordersApi = {
  /** Creates one order per brand from my cart. */
  checkout: (shippingAddress?: Record<string, string>) => http.post<Order[]>("orders/checkout", { shippingAddress }),
  list: (query: { page?: number; limit?: number; status?: OrderStatus } = {}) =>
    http.get<Paginated<Order>>("orders", { ...query }),
  get: (id: string) => http.get<Order>(`orders/${id}`),
  cancel: (id: string, reason?: string) => http.post<Order>(`orders/${id}/cancel`, { reason }),

  refunds: (id: string) => http.get<Refund[]>(`orders/${id}/refunds`),
  requestRefund: (id: string, input: { amount: number; reason: string }) =>
    http.post<Refund>(`orders/${id}/refunds`, input),
  approveRefund: (id: string, refundId: string) => http.post<Refund>(`orders/${id}/refunds/${refundId}/approve`),
  rejectRefund: (id: string, refundId: string, reason: string) =>
    http.post<Refund>(`orders/${id}/refunds/${refundId}/reject`, { reason }),

  shipments: (id: string) => http.get<Shipment[]>(`orders/${id}/shipments`),
  createShipment: (id: string, input: { carrier: string; trackingNumber: string; trackingUrl?: string }) =>
    http.post<Shipment>(`orders/${id}/shipments`, input),
  updateShipment: (id: string, shipmentId: string, status: ShipmentStatus) =>
    http.patch<Shipment>(`orders/${id}/shipments/${shipmentId}/status`, { status }),
};

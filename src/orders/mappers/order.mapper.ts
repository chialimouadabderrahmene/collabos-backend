import {
  CartItem,
  Order,
  OrderItem,
  ProductVariant,
  Refund,
  Shipment,
} from '@prisma/client';
import {
  CartItemResponse,
  CartResponse,
  OrderItemResponse,
  OrderResponse,
  RefundResponse,
  ShipmentResponse,
} from '../types/order-response.types';

type CartItemWithVariant = CartItem & {
  variant: ProductVariant & { product: { name: string; price: number } };
};

export function toCartResponse(
  cartId: string,
  items: CartItemWithVariant[],
): CartResponse {
  const mappedItems: CartItemResponse[] = items.map((item) => {
    const unitPrice = item.variant.priceOverride ?? item.variant.product.price;
    return {
      id: item.id,
      variantId: item.variantId,
      productName: item.variant.product.name,
      sku: item.variant.sku,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
    };
  });

  return {
    id: cartId,
    items: mappedItems,
    total: mappedItems.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}

export function toOrderItemResponse(item: OrderItem): OrderItemResponse {
  return {
    id: item.id,
    variantId: item.variantId,
    productName: item.productName,
    sku: item.sku,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
  };
}

export function toOrderResponse(
  order: Order & { items: OrderItem[] },
): OrderResponse {
  return {
    id: order.id,
    buyerId: order.buyerId,
    brandId: order.brandId,
    status: order.status,
    subtotal: order.subtotal,
    currency: order.currency,
    items: order.items.map((item) => toOrderItemResponse(item)),
    cancelledAt: order.cancelledAt,
    completedAt: order.completedAt,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toRefundResponse(refund: Refund): RefundResponse {
  return {
    id: refund.id,
    orderId: refund.orderId,
    amount: refund.amount,
    reason: refund.reason,
    status: refund.status,
    rejectedReason: refund.rejectedReason,
    createdAt: refund.createdAt,
    processedAt: refund.processedAt,
  };
}

export function toShipmentResponse(shipment: Shipment): ShipmentResponse {
  return {
    id: shipment.id,
    orderId: shipment.orderId,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
    status: shipment.status,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
  };
}

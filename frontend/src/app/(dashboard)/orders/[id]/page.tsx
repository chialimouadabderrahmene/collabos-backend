import type { Metadata } from "next";
import { OrderScreen } from "@/features/orders/order-screens";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderScreen key={id} orderId={id} />;
}

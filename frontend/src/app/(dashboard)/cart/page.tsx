import type { Metadata } from "next";
import { CartScreen } from "@/features/orders/order-screens";

export const metadata: Metadata = { title: "Bag" };

export default function CartPage() {
  return <CartScreen />;
}

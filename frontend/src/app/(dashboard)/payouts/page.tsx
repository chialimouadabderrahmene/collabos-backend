import type { Metadata } from "next";
import { PayoutsScreen } from "@/features/payouts/payouts-screen";

export const metadata: Metadata = { title: "Payouts" };

export default function PayoutsPage() {
  return <PayoutsScreen />;
}

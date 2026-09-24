import type { Metadata } from "next";
import { DealsList } from "@/features/deals/deals-list";

export const metadata: Metadata = { title: "Deals" };

export default function DealsPage() {
  return <DealsList />;
}

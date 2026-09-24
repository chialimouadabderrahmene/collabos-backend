import type { Metadata } from "next";
import { DealScreen } from "@/features/deals/deal-screen";

export const metadata: Metadata = { title: "Deal" };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealScreen key={id} dealId={id} />;
}

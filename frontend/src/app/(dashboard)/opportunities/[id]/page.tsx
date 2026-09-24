import type { Metadata } from "next";
import { OpportunityOverview } from "@/features/opportunities/opportunity-overview";

export const metadata: Metadata = { title: "Opportunity" };

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OpportunityOverview opportunityId={id} />;
}

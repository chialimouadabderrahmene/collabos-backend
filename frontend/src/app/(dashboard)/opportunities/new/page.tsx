import type { Metadata } from "next";
import { NewOpportunityForm } from "@/features/opportunities/new-opportunity-form";

export const metadata: Metadata = { title: "New Opportunity" };

export default function NewOpportunityPage() {
  return <NewOpportunityForm />;
}

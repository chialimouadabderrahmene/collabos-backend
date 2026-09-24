import type { Metadata } from "next";
import { NewDealForm } from "@/features/deals/new-deal-form";

export const metadata: Metadata = { title: "Start a deal" };

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ applicationId?: string | string[] }>;
}) {
  const { applicationId } = await searchParams;
  return <NewDealForm applicationId={typeof applicationId === "string" ? applicationId : null} />;
}

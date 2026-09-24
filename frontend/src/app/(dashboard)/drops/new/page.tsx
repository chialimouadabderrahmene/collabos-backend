import type { Metadata } from "next";
import { NewDropForm } from "@/features/drops/drop-screens";

export const metadata: Metadata = { title: "Build a drop" };

export default async function NewDropPage({ searchParams }: { searchParams: Promise<{ dealId?: string | string[] }> }) {
  const { dealId } = await searchParams;
  return <NewDropForm dealId={typeof dealId === "string" ? dealId : null} />;
}

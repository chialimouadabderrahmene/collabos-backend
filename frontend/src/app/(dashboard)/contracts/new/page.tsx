import type { Metadata } from "next";
import { NewContractForm } from "@/features/contracts/contract-screens";

export const metadata: Metadata = { title: "Draft contract" };

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string | string[] }>;
}) {
  const { dealId } = await searchParams;
  return <NewContractForm dealId={typeof dealId === "string" ? dealId : null} />;
}

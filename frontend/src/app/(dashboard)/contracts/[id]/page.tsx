import type { Metadata } from "next";
import { ContractScreen } from "@/features/contracts/contract-screens";

export const metadata: Metadata = { title: "Contract" };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContractScreen key={id} contractId={id} />;
}

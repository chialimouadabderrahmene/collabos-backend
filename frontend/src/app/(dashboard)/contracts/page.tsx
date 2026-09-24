import type { Metadata } from "next";
import { ContractsList } from "@/features/contracts/contract-screens";

export const metadata: Metadata = { title: "Contracts" };

export default function ContractsPage() {
  return <ContractsList />;
}

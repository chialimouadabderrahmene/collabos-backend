import type { Metadata } from "next";
import { SalesScreen } from "@/features/sales/sales-screen";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage() {
  return <SalesScreen />;
}

import type { Metadata } from "next";
import { DropsList } from "@/features/drops/drop-screens";

export const metadata: Metadata = { title: "Drops" };

export default function DropsPage() {
  return <DropsList />;
}

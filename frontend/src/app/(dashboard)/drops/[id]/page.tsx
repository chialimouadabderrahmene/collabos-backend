import type { Metadata } from "next";
import { DropScreen } from "@/features/drops/drop-screens";

export const metadata: Metadata = { title: "Drop" };

export default async function DropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DropScreen key={id} dropId={id} />;
}

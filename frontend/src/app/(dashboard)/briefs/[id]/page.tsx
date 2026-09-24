import type { Metadata } from "next";
import { BriefScreen } from "@/features/briefs/brief-screen";

export const metadata: Metadata = { title: "Brief" };

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BriefScreen briefId={id} />;
}

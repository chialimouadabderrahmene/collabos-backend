import type { Metadata } from "next";
import { StudioScreen } from "@/features/editor/studio-screen";

export const metadata: Metadata = { title: "Studio" };

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudioScreen opportunityId={id} />;
}

import type { Metadata } from "next";
import { PreviewScreen } from "@/features/opportunities/preview-screen";

export const metadata: Metadata = { title: "Preview" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PreviewScreen opportunityId={id} />;
}

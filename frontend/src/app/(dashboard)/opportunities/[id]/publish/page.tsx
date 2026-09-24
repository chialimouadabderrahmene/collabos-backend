import type { Metadata } from "next";
import { PublishScreen } from "@/features/opportunities/publish-screen";

export const metadata: Metadata = { title: "Publish" };

export default async function PublishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublishScreen opportunityId={id} />;
}

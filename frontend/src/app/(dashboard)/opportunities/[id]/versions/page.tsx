import type { Metadata } from "next";
import { VersionsScreen } from "@/features/opportunities/versions-screen";

export const metadata: Metadata = { title: "Versions" };

export default async function VersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VersionsScreen opportunityId={id} />;
}

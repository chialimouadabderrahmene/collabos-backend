import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VersionScreen } from "@/features/opportunities/versions-screen";

export const metadata: Metadata = { title: "Published version" };

export default async function VersionPage({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { id, version } = await params;
  const versionNumber = Number(version);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    notFound();
  }
  return <VersionScreen opportunityId={id} versionNumber={versionNumber} />;
}

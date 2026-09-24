import type { Metadata } from "next";
import { Suspense } from "react";
import { ShareScreen } from "@/features/sharing/share-screen";

export const metadata: Metadata = { title: "Share" };

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ShareScreen opportunityId={id} />
    </Suspense>
  );
}

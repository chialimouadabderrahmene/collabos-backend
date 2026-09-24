import type { Metadata } from "next";
import { BrandProfileScreen } from "@/features/explore/brand-profile-screen";

export const metadata: Metadata = { title: "Brand" };

export default async function BrandProfilePage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  return <BrandProfileScreen brandId={brandId} />;
}

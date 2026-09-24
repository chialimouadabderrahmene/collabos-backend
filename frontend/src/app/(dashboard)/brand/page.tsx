import type { Metadata } from "next";
import { BrandSettingsScreen } from "@/features/account/account-screens";

export const metadata: Metadata = { title: "Brand settings" };

export default function Page() {
  return <BrandSettingsScreen />;
}

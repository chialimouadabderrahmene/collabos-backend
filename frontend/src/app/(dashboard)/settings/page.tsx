import type { Metadata } from "next";
import { SettingsScreen } from "@/features/account/account-screens";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <SettingsScreen />;
}

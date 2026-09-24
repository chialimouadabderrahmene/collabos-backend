import type { Metadata } from "next";
import { ProfileScreen } from "@/features/account/account-screens";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <ProfileScreen />;
}

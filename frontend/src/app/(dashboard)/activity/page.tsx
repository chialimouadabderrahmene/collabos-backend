import type { Metadata } from "next";
import { ActivityScreen } from "@/features/account/account-screens";

export const metadata: Metadata = { title: "Activity" };

export default function Page() {
  return <ActivityScreen />;
}

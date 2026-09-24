import type { Metadata } from "next";
import { TeamScreen } from "@/features/brands/team-screen";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return <TeamScreen />;
}

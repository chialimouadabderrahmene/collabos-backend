import type { Metadata } from "next";
import { NewBriefForm } from "@/features/briefs/new-brief-form";

export const metadata: Metadata = { title: "Post a brief" };

export default function NewBriefPage() {
  return <NewBriefForm />;
}

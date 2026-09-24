import type { Metadata } from "next";
import { CreateHub } from "@/features/opportunities/create-hub";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return <CreateHub />;
}

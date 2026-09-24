import type { Metadata } from "next";
import { MessagesLayout } from "@/features/messages/messages-screen";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return <MessagesLayout />;
}

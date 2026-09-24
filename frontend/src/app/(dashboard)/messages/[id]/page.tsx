import type { Metadata } from "next";
import { MessagesLayout, ThreadScreen } from "@/features/messages/messages-screen";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <MessagesLayout activeId={id}>
      <ThreadScreen key={id} conversationId={id} />
    </MessagesLayout>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/http";
import { messagesApi } from "@/lib/api/messages";

/** Opens (creates) a conversation with a brand's owner and navigates to it. */
export function useStartBrandConversation() {
  const router = useRouter();
  return useMutation({
    mutationFn: (brand: { id: string; ownerId: string }) =>
      messagesApi.start({
        participantIds: [brand.ownerId],
        contextType: "BRAND",
        contextId: brand.id,
      }),
    onSuccess: (conversation) => router.push(`/messages/${conversation.id}`),
    onError: (error) =>
      toast.error(
        "Couldn't open the conversation",
        error instanceof ApiError ? error.message : undefined,
      ),
  });
}

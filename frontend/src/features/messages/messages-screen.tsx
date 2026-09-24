"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowLeft, FileText, MessageCircle, Paperclip, SendHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/navigation/page";
import { IconButton } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState, SkeletonList } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/hooks";
import { useMyBrands } from "@/features/brands/workspace";
import { brandsApi } from "@/lib/api/brands";
import { ApiError } from "@/lib/api/http";
import {
  MESSAGE_ATTACHMENT_TYPES,
  MESSAGE_BODY_MAX,
  messagesApi,
  type Conversation,
  type Message,
} from "@/lib/api/messages";
import { queryKeys } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatRelative } from "@/lib/utils/format";

/** Realtime is WebSocket-authenticated with a bearer token the browser never
 * holds (httpOnly session), so threads poll while visible. See gaps doc. */
const THREAD_POLL_MS = 5_000;
const LIST_POLL_MS = 15_000;

/* ------------------------------------------------------------ titles */

/**
 * The backend exposes participant ids only (no names) — documented gap. We
 * title a conversation by its context instead: a BRAND thread shows the
 * brand, and flags inquiries to a brand I work on.
 */
export function useConversationTitle(conversation: Conversation | undefined) {
  const brandId = conversation?.contextType === "BRAND" ? conversation.contextId : null;
  const myBrands = useMyBrands();
  const brand = useQuery({
    queryKey: queryKeys.brands.detail(brandId ?? ""),
    queryFn: () => brandsApi.get(brandId as string),
    enabled: !!brandId,
    staleTime: 5 * 60_000,
  });

  if (!conversation) return { title: "", subtitle: undefined as string | undefined };
  if (brandId) {
    const mine = myBrands.data?.some((item) => item.id === brandId);
    const name = brand.data?.name ?? "Brand";
    return mine
      ? { title: `Inquiry · ${name}`, subtitle: "Someone reached out to your brand" }
      : { title: name, subtitle: "Brand conversation" };
  }
  const context = conversation.contextType
    ? `${conversation.contextType.charAt(0)}${conversation.contextType.slice(1).toLowerCase()} conversation`
    : "Conversation";
  const others = conversation.participants.length - 1;
  return { title: context, subtitle: others > 1 ? `${others} participants` : undefined };
}

/* -------------------------------------------------------- list screen */

function ConversationRow({ conversation, active }: { conversation: Conversation; active: boolean }) {
  const { title, subtitle } = useConversationTitle(conversation);
  const session = useSession();
  const online = conversation.participants.some(
    (participant) => participant.userId !== session.data?.id && participant.isOnline,
  );
  return (
    <Link
      href={`/messages/${conversation.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-3 transition-colors",
        active ? "bg-surface-2" : "hover:bg-surface",
      )}
    >
      <span className="relative">
        <Avatar name={title || "Conversation"} size="sm" />
        {online && (
          <span
            aria-label="Online"
            className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-bg bg-accent"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-body font-semibold text-fg">{title}</span>
          {conversation.lastMessageAt && (
            <span className="shrink-0 text-caption text-faint">{formatRelative(conversation.lastMessageAt)}</span>
          )}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-caption text-muted">{subtitle ?? "Direct message"}</span>
          {conversation.unreadCount > 0 && (
            <span className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[0.6875rem] font-bold text-accent-ink">
              <span className="sr-only">Unread messages: </span>
              {conversation.unreadCount}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

export function ConversationList({ activeId }: { activeId?: string }) {
  const conversations = useQuery({
    queryKey: queryKeys.messages.conversations,
    queryFn: () => messagesApi.conversations(),
    refetchInterval: LIST_POLL_MS,
  });

  if (conversations.isLoading) return <SkeletonList count={5} className="px-3" />;
  if (conversations.isError) {
    return <ErrorState title="Couldn't load conversations" onRetry={() => conversations.refetch()} />;
  }
  const items = conversations.data?.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MessageCircle className="size-5" aria-hidden />}
        title="No conversations yet"
        description="Message a brand from Explore to start a collaboration."
        action={
          <Link href="/explore" className="text-body font-semibold text-accent hover:text-accent-hover">
            Explore brands
          </Link>
        }
      />
    );
  }
  return (
    <nav aria-label="Conversations" className="flex flex-col gap-0.5">
      {items.map((conversation) => (
        <ConversationRow key={conversation.id} conversation={conversation} active={conversation.id === activeId} />
      ))}
    </nav>
  );
}

/** Two-pane on desktop; on mobile the list and the thread are separate screens. */
export function MessagesLayout({ activeId, children }: { activeId?: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] w-full max-w-7xl lg:h-dvh lg:gap-0 lg:px-6 lg:py-6">
      <aside
        className={cn(
          "w-full flex-col overflow-y-auto px-4 pt-5 pb-24 lg:flex lg:w-80 lg:shrink-0 lg:border-r lg:border-border lg:px-2 lg:pt-4 lg:pb-4",
          activeId ? "hidden" : "flex",
        )}
      >
        <PageHeader title="Messages" className="mb-4 px-1" />
        <ConversationList activeId={activeId} />
      </aside>
      <section className={cn("min-w-0 flex-1 flex-col", activeId ? "flex" : "hidden lg:flex")}>
        {children ?? (
          <div className="flex flex-1 items-center justify-center p-10">
            <EmptyState
              icon={<MessageCircle className="size-5" aria-hidden />}
              title="Select a conversation"
              description="Pick a thread to read and reply."
              className="max-w-md border-none"
            />
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------- thread */

function precheckAttachment(file: File): string | null {
  if (!MESSAGE_ATTACHMENT_TYPES.includes(file.type)) {
    return "Attach an image (JPEG, PNG, WEBP, GIF) or a PDF.";
  }
  return null;
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3.5 py-2.5",
          mine ? "rounded-br-sm bg-accent text-accent-ink" : "rounded-bl-sm border border-border bg-surface text-fg",
        )}
      >
        {message.body && <p className="text-body break-words whitespace-pre-wrap">{message.body}</p>}
        {message.attachments.map((attachment) =>
          attachment.mimeType.startsWith("image/") ? (
            <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="mt-1.5 block">
              {/* eslint-disable-next-line @next/next/no-img-element -- backend-served attachment */}
              <img
                src={attachment.url}
                alt={attachment.fileName}
                className="max-h-64 rounded-md object-cover"
                loading="lazy"
              />
            </a>
          ) : (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "mt-1.5 flex items-center gap-2 rounded-md px-2.5 py-2 text-caption font-semibold",
                mine ? "bg-black/10" : "bg-surface-2",
              )}
            >
              <FileText className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{attachment.fileName}</span>
            </a>
          ),
        )}
        <p className={cn("mt-1 text-[0.6875rem]", mine ? "text-accent-ink/60" : "text-faint")}>
          <time dateTime={message.createdAt}>{formatDate(message.createdAt, true)}</time>
        </p>
      </div>
    </div>
  );
}

export function ThreadScreen({ conversationId }: { conversationId: string }) {
  const client = useQueryClient();
  const session = useSession();
  const me = session.data?.id;
  const conversation = useQuery({
    queryKey: queryKeys.messages.conversation(conversationId),
    queryFn: () => messagesApi.conversation(conversationId),
    retry: (count, error) => !(error instanceof ApiError && (error.isNotFound || error.isForbidden)) && count < 2,
  });
  const { title, subtitle } = useConversationTitle(conversation.data);

  const thread = useInfiniteQuery({
    queryKey: queryKeys.messages.thread(conversationId),
    queryFn: ({ pageParam }) => messagesApi.messages(conversationId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    enabled: conversation.isSuccess,
    refetchInterval: THREAD_POLL_MS,
  });

  // Pages arrive newest-first; display oldest-first, de-duplicated.
  const messages = useMemo(() => {
    const seen = new Set<string>();
    const all: Message[] = [];
    for (const page of thread.data?.pages ?? []) {
      for (const message of page.data) {
        if (!seen.has(message.id)) {
          seen.add(message.id);
          all.push(message);
        }
      }
    }
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [thread.data]);

  const newest = messages.at(-1)?.id;
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!newest) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
    // Mark as read whenever a new message is displayed.
    void messagesApi
      .markSeen(conversationId)
      .then(() => client.invalidateQueries({ queryKey: queryKeys.messages.conversations }))
      .catch(() => undefined);
  }, [newest, conversationId, client]);

  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const send = useMutation({
    mutationFn: () =>
      messagesApi.send(conversationId, { body: body.trim() || undefined, attachment: attachment ?? undefined }),
    onSuccess: () => {
      setBody("");
      setAttachment(null);
      void client.invalidateQueries({ queryKey: queryKeys.messages.thread(conversationId) });
      void client.invalidateQueries({ queryKey: queryKeys.messages.conversations });
    },
    onError: (error) =>
      toast.error("Message not sent", error instanceof ApiError ? error.message : "Check your connection and try again."),
  });

  const canSend = (!!body.trim() || !!attachment) && body.length <= MESSAGE_BODY_MAX && !send.isPending;

  if (conversation.isError) {
    const hidden =
      conversation.error instanceof ApiError && (conversation.error.isNotFound || conversation.error.isForbidden);
    return (
      <div className="p-6">
        <ErrorState
          title={hidden ? "Conversation not found" : "Couldn't load conversation"}
          description={hidden ? "It may not exist, or you're not a participant." : undefined}
          onRetry={hidden ? undefined : () => conversation.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:pl-6">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 lg:px-0 lg:pt-0">
        <Link
          href="/messages"
          aria-label="Back to conversations"
          className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        {conversation.isLoading ? (
          <div className="skeleton h-5 w-40 rounded" />
        ) : (
          <>
            <Avatar name={title || "Conversation"} size="sm" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-heading text-fg">{title}</h1>
              {subtitle && <p className="truncate text-caption text-muted">{subtitle}</p>}
            </div>
            {conversation.data?.contextType && <Badge>{conversation.data.contextType}</Badge>}
          </>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-0 lg:pr-2" aria-live="polite">
        {thread.hasNextPage && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={() => thread.fetchNextPage()}
              disabled={thread.isFetchingNextPage}
              className="text-caption font-semibold text-muted hover:text-fg"
            >
              {thread.isFetchingNextPage ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}
        {thread.isLoading || conversation.isLoading ? (
          <LoadingState label="Loading messages" />
        ) : thread.isError ? (
          <ErrorState title="Couldn't load messages" onRetry={() => thread.refetch()} />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-body text-muted">No messages yet. Say hello.</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {messages.map((message) => (
              <li key={message.id}>
                <Bubble message={message} mine={message.senderId === me} />
              </li>
            ))}
          </ol>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="safe-bottom border-t border-border px-4 pt-3 pb-3 lg:px-0"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) send.mutate();
        }}
      >
        {attachment && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-caption text-fg-2">
            <Paperclip className="size-3.5" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={() => setAttachment(null)}
              className="text-faint hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={MESSAGE_ATTACHMENT_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const problem = precheckAttachment(file);
              if (problem) {
                toast.error("Can't attach that file", problem);
                return;
              }
              setAttachment(file);
            }}
          />
          <IconButton
            type="button"
            variant="ghost"
            label="Attach a file"
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip className="size-5" aria-hidden />
          </IconButton>
          <label htmlFor="message-body" className="sr-only">
            Message
          </label>
          <textarea
            id="message-body"
            rows={1}
            value={body}
            maxLength={MESSAGE_BODY_MAX}
            placeholder="Write a message…"
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (canSend) send.mutate();
              }
            }}
            className="max-h-40 min-h-11 flex-1 resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-body text-fg placeholder:text-faint focus:border-accent-line focus:outline-none"
          />
          <IconButton type="submit" label="Send message" disabled={!canSend}>
            <SendHorizontal className="size-5" aria-hidden />
          </IconButton>
        </div>
      </form>
    </div>
  );
}

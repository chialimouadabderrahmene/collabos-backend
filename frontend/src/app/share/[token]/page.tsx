import { Link2Off } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { Publication, resolverFrom } from "@/components/editorial/publication";
import { readPresentation } from "@/features/editor/document-model";
import { fetchSharedOpportunity } from "@/lib/api/share.server";
import { formatDate } from "@/lib/utils/format";

type Props = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const result = await fetchSharedOpportunity(token);
  return {
    title: result.status === "ok" ? result.data.title : "Shared Opportunity",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

function Unavailable({ rateLimited }: { rateLimited?: boolean }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="mb-6 flex size-14 items-center justify-center rounded-xl border border-border bg-surface text-muted">
        <Link2Off className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-title">
        {rateLimited ? "Too many requests" : "This link isn't available"}
      </h1>
      <p className="mt-2 text-body text-muted">
        {rateLimited
          ? "Please wait a minute and reload the page."
          : "It may have expired or been revoked by its owner. Ask them for a new link."}
      </p>
      <Link href="/" className="mt-10">
        <Wordmark size="sm" />
      </Link>
    </div>
  );
}

/** Public, login-free view of one immutable published version. */
export default async function SharedOpportunityPage({ params }: Props) {
  const { token } = await params;
  const result = await fetchSharedOpportunity(token);

  if (result.status === "unavailable") {
    return <Unavailable />;
  }
  if (result.status === "rate-limited") {
    return <Unavailable rateLimited />;
  }
  if (result.status === "error") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-title">Something went wrong</h1>
        <p className="mt-2 text-body text-muted">We couldn&apos;t load this page. Please try again shortly.</p>
      </div>
    );
  }

  const data = result.data;
  return (
    <div className="min-h-dvh">
      <main className="py-12 sm:py-20">
        <Publication
          title={data.title}
          summary={data.summary}
          content={data.content}
          presentation={readPresentation(data.metadata)}
          resolveAsset={resolverFrom(data.assets)}
          brand={data.brand}
          meta={`Published ${formatDate(data.publishedAt)}`}
        />
      </main>
      <footer className="border-t border-border px-6 py-8 text-center">
        <p className="text-caption text-faint">
          Shared privately via{" "}
          <Link href="/" className="text-fg-2 hover:text-accent">
            CollabOS
          </Link>
          {data.expiresAt && ` · available until ${formatDate(data.expiresAt)}`}
        </p>
      </footer>
    </div>
  );
}

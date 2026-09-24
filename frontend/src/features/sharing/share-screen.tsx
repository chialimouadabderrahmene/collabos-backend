"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Link2Off, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BackLink, Breadcrumbs, PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Badge, Card, Eyebrow, type BadgeTone } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState, SkeletonList } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { ConfirmationDialog } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { useOpportunity } from "@/features/opportunities/hooks";
import { ApiError } from "@/lib/api/http";
import { opportunitiesApi, type CreatedShareLink, type ShareLink, type ShareLinkStatus } from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, formatRelative } from "@/lib/utils/format";

const EXPIRY = [
  { value: "never", label: "Never expires" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "custom", label: "Custom date" },
] as const;
type Expiry = (typeof EXPIRY)[number]["value"];

const STATUS_TONE: Record<ShareLinkStatus, BadgeTone> = {
  ACTIVE: "accent",
  EXPIRED: "warning",
  REVOKED: "danger",
};

/** Expiry → ISO timestamp (undefined = never). Pure, unit tested. */
export function expiryToIso(choice: Expiry, customDate: string, now = new Date()): string | undefined {
  if (choice === "never") {
    return undefined;
  }
  if (choice === "custom") {
    return customDate ? new Date(`${customDate}T23:59:59`).toISOString() : undefined;
  }
  return new Date(now.getTime() + Number(choice) * 86_400_000).toISOString();
}

function shareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

function CreatedLink({ link, onDone }: { link: CreatedShareLink; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = shareUrl(link.token);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually");
    }
  };
  return (
    <Card highlight className="p-5">
      <Eyebrow tone="accent" className="mb-2 flex items-center gap-1.5">
        <ShieldCheck className="size-3.5" aria-hidden /> Private link created
      </Eyebrow>
      <p className="mb-3 text-caption text-fg-2">
        Copy it now — for security it is shown only once. Anyone with the link can view version{" "}
        {link.versionNumber}{link.expiresAt ? ` until ${formatDate(link.expiresAt)}` : ""}.
      </p>
      <div className="flex gap-2">
        <label htmlFor="new-share-link" className="sr-only">
          Share link
        </label>
        <Input id="new-share-link" readOnly value={url} onFocus={(event) => event.target.select()} className="font-mono text-caption" />
        <Button onClick={copy} className="shrink-0">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="mt-3" onClick={onDone}>
        Done
      </Button>
    </Card>
  );
}

function LinkRow({ link, onRevoke }: { link: ShareLink; onRevoke: (link: ShareLink) => void }) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-body font-semibold text-fg">{link.label ?? `Link ${link.tokenPrefix}…`}</p>
          <Badge tone={STATUS_TONE[link.status]}>{link.status}</Badge>
          <Badge tone="neutral">v{link.versionNumber}</Badge>
        </div>
        <p className="mt-1 text-caption text-muted">
          <span className="font-mono">/share/{link.tokenPrefix}…</span> · created {formatRelative(link.createdAt)}
          {link.expiresAt && ` · ${link.status === "EXPIRED" ? "expired" : "expires"} ${formatDate(link.expiresAt)}`}
        </p>
        <p className="mt-0.5 text-caption text-faint">
          {link.accessCount} view{link.accessCount === 1 ? "" : "s"}
          {link.lastAccessedAt ? ` · last opened ${formatRelative(link.lastAccessedAt)}` : " · not opened yet"}
        </p>
      </div>
      {link.status === "ACTIVE" && (
        <Button variant="danger" size="sm" onClick={() => onRevoke(link)}>
          <Link2Off className="size-4" aria-hidden /> Revoke
        </Button>
      )}
    </li>
  );
}

export function ShareScreen({ opportunityId }: { opportunityId: string }) {
  const client = useQueryClient();
  const params = useSearchParams();
  const opportunity = useOpportunity(opportunityId);
  const versions = useQuery({
    queryKey: queryKeys.opportunities.versions(opportunityId),
    queryFn: () => opportunitiesApi.versions(opportunityId),
  });
  const links = useQuery({
    queryKey: queryKeys.opportunities.shareLinks(opportunityId),
    queryFn: () => opportunitiesApi.shareLinks.list(opportunityId),
    enabled: Boolean(opportunity.data?.capabilities?.share),
  });

  const [chosenVersion, setVersionNumber] = useState<number | null>(null);
  // Bounds for the custom-date input, computed once at mount.
  const [dateBounds] = useState(() => ({
    min: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    max: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
  }));
  const [expiry, setExpiry] = useState<Expiry>("30");
  const [customDate, setCustomDate] = useState("");
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<CreatedShareLink | null>(null);
  const [revoking, setRevoking] = useState<ShareLink | null>(null);

  // Default: the version from ?version=, else the latest. Derived, not synced.
  const requested = Number(params.get("version"));
  const defaultVersion = versions.data?.some((version) => version.versionNumber === requested)
    ? requested
    : (versions.data?.[0]?.versionNumber ?? null);
  const versionNumber = chosenVersion ?? defaultVersion;

  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.opportunities.shareLinks(opportunityId) });

  const create = useMutation({
    mutationFn: () =>
      opportunitiesApi.shareLinks.create(opportunityId, {
        versionNumber: versionNumber as number,
        expiresAt: expiryToIso(expiry, customDate),
        label: label.trim() || undefined,
      }),
    onSuccess: (link) => {
      setCreated(link);
      setLabel("");
      void invalidate();
    },
  });
  const revoke = useMutation({
    mutationFn: (link: ShareLink) => opportunitiesApi.shareLinks.revoke(opportunityId, link.id),
    onSuccess: () => {
      toast.success("Link revoked", "It stops working immediately.");
      setRevoking(null);
      void invalidate();
    },
    onError: (error) => toast.error("Couldn't revoke", error instanceof ApiError ? error.message : undefined),
  });

  if (opportunity.isLoading || versions.isLoading) {
    return <LoadingState />;
  }
  if (opportunity.isError || !opportunity.data) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load sharing" onRetry={() => opportunity.refetch()} />
      </PageContainer>
    );
  }

  const data = opportunity.data;
  const base = `/opportunities/${data.id}`;
  const allowed = Boolean(data.capabilities?.share) && !data.archivedAt;
  const { min: minDate, max: maxDate } = dateBounds;

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Opportunities", href: "/opportunities" }, { label: data.title, href: base }, { label: "Share" }]} />
      <div className="lg:hidden">
        <BackLink href={base} />
      </div>
      <PageHeader
        title="Private sharing"
        subtitle="Each link is pinned to one published version. Recipients never see the draft."
      />

      {!allowed ? (
        <EmptyState
          icon={<Link2 className="size-5" />}
          title={data.archivedAt ? "Sharing is paused" : "You can't manage sharing"}
          description={
            data.archivedAt
              ? "This Opportunity is archived — restore it to share again."
              : "Only brand admins or the Opportunity's creator can create links."
          }
        />
      ) : !versions.data || versions.data.length === 0 ? (
        <EmptyState
          icon={<Link2 className="size-5" />}
          title="Publish before sharing"
          description="Share links always point to an immutable published version."
        />
      ) : (
        <>
          {created ? (
            <div className="mb-8">
              <CreatedLink link={created} onDone={() => setCreated(null)} />
            </div>
          ) : (
            <Card className="mb-8 p-5">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  create.mutate();
                }}
                className="flex flex-col gap-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Version">
                    {({ id }) => (
                      <Select id={id} value={versionNumber ?? ""} onChange={(event) => setVersionNumber(Number(event.target.value))}>
                        {versions.data.map((version, index) => (
                          <option key={version.versionNumber} value={version.versionNumber}>
                            v{version.versionNumber}
                            {index === 0 ? " (latest)" : ""} · {formatDate(version.publishedAt)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Expiration">
                    {({ id }) => (
                      <Select id={id} value={expiry} onChange={(event) => setExpiry(event.target.value as Expiry)}>
                        {EXPIRY.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                {expiry === "custom" && (
                  <Field label="Expires on" hint="Up to one year from today.">
                    {({ id, describedBy }) => (
                      <Input id={id} type="date" min={minDate} max={maxDate} value={customDate} aria-describedby={describedBy} onChange={(event) => setCustomDate(event.target.value)} />
                    )}
                  </Field>
                )}
                <Field label="Label" optional hint="Only you and your team see this.">
                  {({ id, describedBy }) => (
                    <Input id={id} maxLength={120} value={label} placeholder="Atelier Rossi — first look" aria-describedby={describedBy} onChange={(event) => setLabel(event.target.value)} />
                  )}
                </Field>
                {create.isError && (
                  <p role="alert" className="rounded-md border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-caption text-danger">
                    {create.error instanceof ApiError ? create.error.message : "Couldn't create the link."}
                  </p>
                )}
                <Button
                  type="submit"
                  loading={create.isPending}
                  disabled={versionNumber === null || (expiry === "custom" && !customDate)}
                >
                  <Link2 className="size-4" aria-hidden /> Create private link
                </Button>
              </form>
            </Card>
          )}

          <Eyebrow className="mb-3">Links</Eyebrow>
          {links.isLoading ? (
            <SkeletonList count={2} />
          ) : links.isError ? (
            <ErrorState title="Couldn't load links" onRetry={() => links.refetch()} />
          ) : links.data && links.data.length > 0 ? (
            <Card>
              <ul className="divide-y divide-border">
                {links.data.map((link) => (
                  <LinkRow key={link.id} link={link} onRevoke={setRevoking} />
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState title="No links yet" description="Create a link above to share a version privately." />
          )}
        </>
      )}

      <ConfirmationDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Revoke this link?"
        description="Anyone using it will immediately lose access. This can't be undone."
        confirmLabel="Revoke link"
        tone="danger"
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking)}
      />
    </PageContainer>
  );
}

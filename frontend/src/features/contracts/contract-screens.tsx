"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSignature, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BackLink, PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Badge, Card, Chip, Eyebrow, KeyValue, SectionHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState, Pagination, SkeletonList } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ConfirmationDialog, Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/hooks";
import { CONTRACT_STATUS, partyOf } from "@/features/deals/status";
import {
  CONTRACT_CONTENT,
  contractsApi,
  type Contract,
  type ContractEventType,
  type ContractStatus,
} from "@/lib/api/contracts";
import { dealsApi, type Deal } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils/format";

const apiMessage = (error: unknown) => (error instanceof ApiError ? error.message : undefined);

const EVENT_COPY: Record<ContractEventType, string> = {
  CREATED: "Contract created",
  VERSION_CREATED: "New version drafted",
  SENT_FOR_SIGNATURE: "Sent for signature",
  SIGNED: "Signed",
  FULLY_EXECUTED: "Fully executed",
  VOIDED: "Voided",
};

/* ---------------------------------------------------------------- list */

const FILTERS: Array<{ value: ContractStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "AWAITING_SIGNATURE", label: "To sign" },
  { value: "PARTIALLY_SIGNED", label: "Partially signed" },
  { value: "EXECUTED", label: "Executed" },
];

function ContractRow({ contract }: { contract: Contract }) {
  const deal = useQuery({
    queryKey: queryKeys.deals.detail(contract.dealId),
    queryFn: () => dealsApi.get(contract.dealId),
    staleTime: 5 * 60_000,
  });
  const status = CONTRACT_STATUS[contract.status];
  return (
    <Link href={`/contracts/${contract.id}`} className="block">
      <Card interactive className="flex items-center gap-4 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-tint text-accent">
          <FileSignature className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-body font-bold text-fg">
            {deal.data?.title ?? (deal.isLoading ? "Loading…" : "Collaboration agreement")}
          </p>
          <p className="text-caption text-muted">
            v{contract.currentVersionNumber} · updated {formatRelative(contract.updatedAt)}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </Card>
    </Link>
  );
}

export function ContractsList() {
  const [status, setStatus] = useState<ContractStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: queryKeys.contracts.list({ status, page }),
    queryFn: () => contractsApi.list({ status: status === "ALL" ? undefined : status, page, limit: 10 }),
  });
  return (
    <PageContainer>
      <PageHeader title="Contracts" subtitle="Agreements for your active deals" />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {FILTERS.map((filter) => (
          <Chip
            key={filter.value}
            selected={status === filter.value}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
          >
            {filter.label}
          </Chip>
        ))}
      </div>
      {query.isLoading ? (
        <SkeletonList count={4} />
      ) : query.isError ? (
        <ErrorState title="Couldn't load contracts" onRetry={() => query.refetch()} />
      ) : !query.data || query.data.data.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="size-5" aria-hidden />}
          title="No contracts"
          description="Contracts are drafted from an active deal."
          action={
            <Link href="/deals" className="text-body font-semibold text-accent">
              Go to deals
            </Link>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {query.data.data.map((contract) => (
              <li key={contract.id}>
                <ContractRow contract={contract} />
              </li>
            ))}
          </ul>
          <Pagination page={page} limit={10} total={query.data.total} onPageChange={setPage} className="mt-4" />
        </>
      )}
    </PageContainer>
  );
}

/* ----------------------------------------------------------- new draft */

function draftTemplate(deal: Deal): string {
  const lines = [
    `COLLABORATION AGREEMENT — ${deal.title}`,
    "",
    "1. Scope",
    "Describe the deliverables and responsibilities of each party.",
    "",
    "2. Compensation",
    deal.totalValue !== null
      ? `Total value: ${formatMoney(deal.totalValue, deal.currency)}.`
      : "Total value: to be agreed.",
    deal.revenueSplitBrand !== null && deal.revenueSplitCreator !== null
      ? `Revenue split: ${deal.revenueSplitBrand}% brand / ${deal.revenueSplitCreator}% creator.`
      : "",
    "",
    "3. Term",
    deal.startDate || deal.endDate
      ? `From ${deal.startDate ? formatDate(deal.startDate) : "signature"} to ${deal.endDate ? formatDate(deal.endDate) : "completion"}.`
      : "From signature until completion of the deliverables.",
    "",
    "4. Intellectual property",
    "",
    "5. Termination",
  ];
  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n");
}

function ContentEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const length = value.trim().length;
  const error =
    length > 0 && length < CONTRACT_CONTENT.min
      ? `At least ${CONTRACT_CONTENT.min} characters`
      : length > CONTRACT_CONTENT.max
        ? `At most ${CONTRACT_CONTENT.max.toLocaleString("en-GB")} characters`
        : undefined;
  return (
    <Field label="Agreement text" hint={`${length.toLocaleString("en-GB")} / ${CONTRACT_CONTENT.max.toLocaleString("en-GB")}`} error={error}>
      {({ id, describedBy, invalid }) => (
        <Textarea
          id={id}
          rows={18}
          value={value}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="font-mono text-caption leading-relaxed"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

const contentValid = (value: string) =>
  value.trim().length >= CONTRACT_CONTENT.min && value.trim().length <= CONTRACT_CONTENT.max;

export function NewContractForm({ dealId }: { dealId: string | null }) {
  const router = useRouter();
  const client = useQueryClient();
  const deal = useQuery({
    queryKey: queryKeys.deals.detail(dealId ?? ""),
    queryFn: () => dealsApi.get(dealId as string),
    enabled: !!dealId,
  });
  const [content, setContent] = useState<string | null>(null);
  const text = content ?? (deal.data ? draftTemplate(deal.data) : "");
  const create = useMutation({
    mutationFn: () => contractsApi.create({ dealId: dealId as string, content: text.trim() }),
    onSuccess: (contract) => {
      void client.invalidateQueries({ queryKey: queryKeys.contracts.all });
      toast.success("Contract drafted", "Review it, then send it for signature.");
      router.push(`/contracts/${contract.id}`);
    },
    onError: (error) => toast.error("Couldn't create the contract", apiMessage(error)),
  });

  if (!dealId) {
    return (
      <PageContainer>
        <BackLink href="/contracts" />
        <ErrorState title="Choose a deal first" description="Contracts are drafted from an active deal." />
      </PageContainer>
    );
  }
  if (deal.isLoading) return <LoadingState />;
  if (deal.isError || !deal.data) {
    return (
      <PageContainer>
        <BackLink href="/deals" />
        <ErrorState title="Deal not found" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <BackLink href={`/deals/${dealId}`} />
      <PageHeader title="Draft contract" subtitle={deal.data.title} />
      <p className="mb-4 text-caption text-muted">
        Plain-text agreement. A PDF is generated for each version. You can revise it until it&apos;s sent for signature.
      </p>
      <ContentEditor value={text} onChange={setContent} />
      <Button className="mt-5" size="lg" fullWidth disabled={!contentValid(text)} loading={create.isPending} onClick={() => create.mutate()}>
        Create draft
      </Button>
    </PageContainer>
  );
}

/* -------------------------------------------------------------- detail */

export function ContractScreen({ contractId }: { contractId: string }) {
  const client = useQueryClient();
  const session = useSession();
  const contract = useQuery({
    queryKey: queryKeys.contracts.detail(contractId),
    queryFn: () => contractsApi.get(contractId),
    retry: (count, error) => !(error instanceof ApiError && (error.isForbidden || error.isNotFound)) && count < 2,
  });
  const versions = useQuery({
    queryKey: queryKeys.contracts.versions(contractId),
    queryFn: () => contractsApi.versions(contractId),
    enabled: contract.isSuccess,
  });
  const history = useQuery({
    queryKey: queryKeys.contracts.history(contractId),
    queryFn: () => contractsApi.history(contractId),
    enabled: contract.isSuccess,
  });
  const deal = useQuery({
    queryKey: queryKeys.deals.detail(contract.data?.dealId ?? ""),
    queryFn: () => dealsApi.get(contract.data!.dealId),
    enabled: !!contract.data,
  });

  const [selected, setSelected] = useState<number | null>(null);
  const [dialog, setDialog] = useState<"sign" | "send" | "void" | "revise" | null>(null);
  const [signedName, setSignedName] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [revision, setRevision] = useState("");

  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
    void client.invalidateQueries({ queryKey: queryKeys.contracts.versions(contractId) });
    void client.invalidateQueries({ queryKey: queryKeys.contracts.history(contractId) });
    void client.invalidateQueries({ queryKey: queryKeys.contracts.all });
  };
  const action = useMutation({
    mutationFn: async (kind: "sign" | "send" | "void" | "revise") => {
      if (kind === "sign") return contractsApi.sign(contractId, signedName.trim());
      if (kind === "send") return contractsApi.send(contractId);
      if (kind === "void") return contractsApi.void(contractId, voidReason.trim() || undefined);
      return contractsApi.addVersion(contractId, revision.trim());
    },
    onSuccess: (_result, kind) => {
      setDialog(null);
      setSelected(null);
      refresh();
      toast.success(
        { sign: "Signed", send: "Sent for signature", void: "Contract voided", revise: "New version saved" }[kind],
      );
    },
    onError: (error) => toast.error("Action failed", apiMessage(error)),
  });

  if (contract.isLoading) return <LoadingState />;
  if (contract.isError || !contract.data) {
    const hidden = contract.error instanceof ApiError && (contract.error.isForbidden || contract.error.isNotFound);
    return (
      <PageContainer>
        <BackLink href="/contracts" />
        <ErrorState
          title={hidden ? "Contract not found" : "Couldn't load this contract"}
          description={hidden ? "It may not exist, or you're not a party to it." : undefined}
          onRetry={hidden ? undefined : () => contract.refetch()}
        />
      </PageContainer>
    );
  }

  const data = contract.data;
  const status = CONTRACT_STATUS[data.status];
  const latest = versions.data?.reduce((max, item) => (item.versionNumber > max.versionNumber ? item : max), versions.data[0]);
  const shown = versions.data?.find((item) => item.versionNumber === (selected ?? latest?.versionNumber)) ?? latest;
  const myParty = partyOf(data, session.data?.id);
  const iSigned = !!latest?.signatures.some((signature) => signature.party === myParty);
  const signable = data.status === "AWAITING_SIGNATURE" || data.status === "PARTIALLY_SIGNED";
  const terminal = data.status === "EXECUTED" || data.status === "VOIDED";

  return (
    <PageContainer size="lg">
      <BackLink href={`/deals/${data.dealId}`} label="Deal" />
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge tone={status.tone}>{status.label}</Badge>
          <h1 className="mt-2 font-display text-title text-fg">{deal.data?.title ?? "Collaboration agreement"}</h1>
          <p className="mt-1 text-body text-muted">
            Version {data.currentVersionNumber} · you sign as the {myParty === "BRAND" ? "brand" : "creator"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.status === "DRAFT" && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRevision(latest?.content ?? "");
                  setDialog("revise");
                }}
              >
                <PenLine className="size-4" aria-hidden /> Revise
              </Button>
              <Button size="sm" onClick={() => setDialog("send")}>
                Send for signature
              </Button>
            </>
          )}
          {signable && !iSigned && (
            <Button size="sm" onClick={() => setDialog("sign")}>
              Sign
            </Button>
          )}
          {!terminal && (
            <Button variant="ghost" size="sm" onClick={() => setDialog("void")}>
              Void
            </Button>
          )}
        </div>
      </header>

      {data.status === "VOIDED" && data.voidReason && (
        <p className="mb-6 rounded-md border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-caption text-danger">
          Voided: {data.voidReason}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Agreement">
          {versions.isLoading ? (
            <SkeletonList count={3} />
          ) : versions.isError || !shown ? (
            <ErrorState title="Couldn't load the agreement" onRetry={() => versions.refetch()} />
          ) : (
            <Card className="p-5 lg:p-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Eyebrow>
                  Version {shown.versionNumber}
                  {shown.versionNumber !== latest?.versionNumber && " · superseded"}
                </Eyebrow>
                {shown.pdfAvailable && (
                  <a
                    href={contractsApi.pdfUrl(contractId, shown.versionNumber)}
                    className="inline-flex items-center gap-1.5 text-caption font-semibold text-accent hover:text-accent-hover"
                  >
                    <Download className="size-4" aria-hidden /> PDF
                  </a>
                )}
              </div>
              {/* Plain text only — never interpreted as HTML. */}
              <pre className="font-sans text-body leading-relaxed whitespace-pre-wrap text-fg-2">{shown.content}</pre>
            </Card>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <section>
            <SectionHeader title="Signatures" />
            <Card className="px-4 py-2">
              {(["BRAND", "CREATOR"] as const).map((party) => {
                const signature = latest?.signatures.find((item) => item.party === party);
                return (
                  <KeyValue
                    key={party}
                    label={party === "BRAND" ? "Brand" : "Creator"}
                    value={
                      signature ? (
                        <span className="flex flex-col items-end">
                          <span className="font-display italic">{signature.signedName}</span>
                          <span className="text-caption font-normal text-muted">{formatDate(signature.signedAt, true)}</span>
                        </span>
                      ) : (
                        <span className="text-caption font-normal text-muted">Not signed</span>
                      )
                    }
                  />
                );
              })}
            </Card>
          </section>

          {versions.data && versions.data.length > 1 && (
            <section>
              <SectionHeader title="Versions" />
              <div className="flex flex-wrap gap-2">
                {[...versions.data]
                  .sort((a, b) => b.versionNumber - a.versionNumber)
                  .map((item) => (
                    <Chip
                      key={item.id}
                      selected={item.versionNumber === shown?.versionNumber}
                      onClick={() => setSelected(item.versionNumber)}
                    >
                      v{item.versionNumber}
                    </Chip>
                  ))}
              </div>
            </section>
          )}

          <section>
            <SectionHeader title="History" />
            {history.isLoading ? (
              <SkeletonList count={2} />
            ) : (
              <ol className="flex flex-col gap-3 border-l border-border pl-4">
                {history.data?.map((event) => (
                  <li key={event.id} className="relative">
                    <span aria-hidden className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-accent" />
                    <p className="text-body text-fg">{EVENT_COPY[event.type]}</p>
                    <p className="text-caption text-faint">{formatDate(event.createdAt, true)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      <Modal
        open={dialog === "sign"}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Sign the agreement"
        description={`You're signing version ${latest?.versionNumber ?? data.currentVersionNumber} on behalf of the ${myParty === "BRAND" ? "brand" : "creator"}. Typing your full name is your electronic signature.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              loading={action.isPending}
              disabled={signedName.trim().length < 2}
              onClick={() => action.mutate("sign")}
            >
              Sign
            </Button>
          </>
        }
      >
        <Field label="Full legal name">
          {({ id }) => (
            <Input id={id} autoComplete="name" maxLength={200} value={signedName} onChange={(event) => setSignedName(event.target.value)} />
          )}
        </Field>
      </Modal>

      <ConfirmationDialog
        open={dialog === "send"}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Send for signature?"
        description="The current version is locked and both parties can sign it."
        confirmLabel="Send"
        loading={action.isPending}
        onConfirm={() => action.mutate("send")}
      />

      <Modal
        open={dialog === "void"}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Void this contract?"
        description="Voiding is permanent. Signatures on it will no longer apply."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Keep
            </Button>
            <Button variant="danger" loading={action.isPending} onClick={() => action.mutate("void")}>
              Void contract
            </Button>
          </>
        }
      >
        <Field label="Reason" optional>
          {({ id }) => <Textarea id={id} rows={3} maxLength={500} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />}
        </Field>
      </Modal>

      <Modal
        open={dialog === "revise"}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Revise the agreement"
        description="Saving creates a new version; earlier versions stay in the history."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              loading={action.isPending}
              disabled={!contentValid(revision) || revision.trim() === latest?.content.trim()}
              onClick={() => action.mutate("revise")}
            >
              Save version
            </Button>
          </>
        }
      >
        <ContentEditor value={revision} onChange={setRevision} />
      </Modal>
    </PageContainer>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileSignature, MessageCircle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { BackLink, PageContainer } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Badge, Card, Eyebrow, KeyValue, SectionHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState, SkeletonList } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmationDialog, Modal } from "@/components/ui/overlays";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/hooks";
import { brandsApi } from "@/lib/api/brands";
import { contractsApi } from "@/lib/api/contracts";
import { dealsApi, type Deal, type DealParty, type Proposal } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/http";
import { messagesApi } from "@/lib/api/messages";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils/format";
import { termsSchema, toDealTerms, type TermsValues } from "@/lib/validation/deals";
import { CONTRACT_STATUS, DEAL_HEALTH, DEAL_STATUS, PROPOSAL_STATUS, partyOf } from "./status";
import { EMPTY_TERMS, TermsFields } from "./terms-fields";

const apiMessage = (error: unknown) => (error instanceof ApiError ? error.message : undefined);

function splitLabel(brand: number | null, creator: number | null): string {
  return brand !== null && creator !== null ? `${brand} / ${creator}` : "—";
}

function dateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  return `${start ? formatDate(start) : "…"} → ${end ? formatDate(end) : "…"}`;
}

/* ---------------------------------------------------------- proposals */

function ProposalCard({
  proposal,
  deal,
  me,
  canDecide,
}: {
  proposal: Proposal;
  deal: Deal;
  me: string | undefined;
  canDecide: boolean;
}) {
  const client = useQueryClient();
  const mine = proposal.proposedById === me;
  const from = proposal.proposedById === deal.creatorId ? "Creator" : "Brand";
  const status = PROPOSAL_STATUS[proposal.status];
  const decide = useMutation({
    mutationFn: (accept: boolean) =>
      accept ? dealsApi.proposals.accept(deal.id, proposal.id) : dealsApi.proposals.reject(deal.id, proposal.id),
    onSuccess: (_result, accept) => {
      toast.success(accept ? "Terms accepted — the deal is active" : "Proposal declined");
      void client.invalidateQueries({ queryKey: queryKeys.deals.detail(deal.id) });
      void client.invalidateQueries({ queryKey: queryKeys.deals.all });
    },
    onError: (error) => toast.error("Couldn't update the proposal", apiMessage(error)),
  });

  return (
    <Card highlight={proposal.status === "ACCEPTED"} className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-caption text-muted">
          <span className="font-semibold text-fg-2">{mine ? "You" : from}</span> · {formatRelative(proposal.createdAt)}
        </p>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <KeyValue label="Value" value={proposal.totalValue !== null ? formatMoney(proposal.totalValue, deal.currency) : "—"} />
      <KeyValue label="Split (brand / creator)" value={splitLabel(proposal.revenueSplitBrand, proposal.revenueSplitCreator)} />
      <KeyValue label="Timeline" value={dateRange(proposal.startDate, proposal.endDate)} />
      {proposal.message && <p className="mt-3 text-body whitespace-pre-wrap text-fg-2">{proposal.message}</p>}
      {canDecide && proposal.status === "PENDING" && !mine && (
        <div className="mt-4 flex gap-2">
          <Button size="sm" loading={decide.isPending && decide.variables} onClick={() => decide.mutate(true)}>
            Accept terms
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={decide.isPending && !decide.variables}
            onClick={() => decide.mutate(false)}
          >
            Decline
          </Button>
        </div>
      )}
      {proposal.status === "PENDING" && mine && (
        <p className="mt-3 text-caption text-muted">Waiting for the other party to respond.</p>
      )}
    </Card>
  );
}

function Proposals({ deal, me }: { deal: Deal; me: string | undefined }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const proposals = useQuery({
    queryKey: queryKeys.deals.proposals(deal.id),
    queryFn: () => dealsApi.proposals.list(deal.id),
  });
  const form = useForm<TermsValues>({ resolver: zodResolver(termsSchema), defaultValues: EMPTY_TERMS });
  const counter = useMutation({
    mutationFn: (values: TermsValues) => dealsApi.proposals.create(deal.id, toDealTerms(values)),
    onSuccess: () => {
      toast.success("Counter-proposal sent");
      setOpen(false);
      form.reset(EMPTY_TERMS);
      void client.invalidateQueries({ queryKey: queryKeys.deals.proposals(deal.id) });
    },
    onError: (error) => form.setError("root", { message: apiMessage(error) ?? "Couldn't send the proposal." }),
  });
  const negotiating = deal.status === "NEGOTIATING";

  return (
    <section>
      <SectionHeader title="Proposals" />
      {negotiating && (
        <Button variant="secondary" size="sm" className="mb-4" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden /> Counter-propose
        </Button>
      )}
      {proposals.isLoading ? (
        <SkeletonList count={2} />
      ) : proposals.isError ? (
        <ErrorState title="Couldn't load proposals" onRetry={() => proposals.refetch()} />
      ) : proposals.data?.length === 0 ? (
        <EmptyState title="No proposals" />
      ) : (
        <ol className="flex flex-col gap-3">
          {proposals.data?.map((proposal) => (
            <li key={proposal.id}>
              <ProposalCard proposal={proposal} deal={deal} me={me} canDecide={negotiating} />
            </li>
          ))}
        </ol>
      )}
      <Modal
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          counter.reset();
        }}
        title="Counter-propose"
        description="Send new terms. Accepting them activates the deal."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={counter.isPending} onClick={form.handleSubmit((values) => counter.mutate(values))}>
              Send proposal
            </Button>
          </>
        }
      >
        <TermsFields form={form} currency={deal.currency} />
        {form.formState.errors.root && (
          <p role="alert" className="mt-3 text-caption text-danger">
            {form.formState.errors.root.message}
          </p>
        )}
      </Modal>
    </section>
  );
}

/* --------------------------------------------------------------- plan */

function Plan({ deal }: { deal: Deal }) {
  const client = useQueryClient();
  const mutable = deal.status !== "COMPLETED" && deal.status !== "CANCELLED";
  const milestones = useQuery({
    queryKey: queryKeys.deals.milestones(deal.id),
    queryFn: () => dealsApi.milestones.list(deal.id),
  });
  const responsibilities = useQuery({
    queryKey: queryKeys.deals.responsibilities(deal.id),
    queryFn: () => dealsApi.responsibilities.list(deal.id),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.deals.milestones(deal.id) });
    void client.invalidateQueries({ queryKey: queryKeys.deals.responsibilities(deal.id) });
    void client.invalidateQueries({ queryKey: queryKeys.deals.detail(deal.id) });
  };
  const onError = (error: unknown) => toast.error("Couldn't update the plan", apiMessage(error));

  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");
  const [party, setParty] = useState<DealParty>("CREATOR");
  const [task, setTask] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const toIso = (date: string) => (date ? new Date(`${date}T00:00:00.000Z`).toISOString() : undefined);

  const addMilestone = useMutation({
    mutationFn: () =>
      dealsApi.milestones.create(deal.id, {
        title: milestoneTitle.trim(),
        dueDate: toIso(milestoneDue),
        position: milestones.data?.length ?? 0,
      }),
    onSuccess: () => {
      setMilestoneTitle("");
      setMilestoneDue("");
      refresh();
    },
    onError,
  });
  const addTask = useMutation({
    mutationFn: () => dealsApi.responsibilities.create(deal.id, { party, description: task.trim(), dueDate: toIso(taskDue) }),
    onSuccess: () => {
      setTask("");
      setTaskDue("");
      refresh();
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: async ({ kind, id, remove }: { kind: "milestone" | "task"; id: string; remove?: boolean }) => {
      const api = kind === "milestone" ? dealsApi.milestones : dealsApi.responsibilities;
      await (remove ? api.remove(deal.id, id) : api.complete(deal.id, id));
    },
    onSuccess: refresh,
    onError,
  });

  const row = (
    kind: "milestone" | "task",
    item: { id: string; isCompleted: boolean; dueDate: string | null },
    label: string,
    meta?: string,
  ) => (
    <li key={item.id} className="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        disabled={!mutable || item.isCompleted}
        onClick={() => toggle.mutate({ kind, id: item.id })}
        aria-label={item.isCompleted ? `${label} completed` : `Mark ${label} complete`}
        className={
          item.isCompleted
            ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"
            : "size-5 shrink-0 rounded-full border border-border-strong hover:border-accent disabled:hover:border-border-strong"
        }
      >
        {item.isCompleted && <Check className="size-3" strokeWidth={3} aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={item.isCompleted ? "text-body text-muted line-through" : "text-body text-fg"}>{label}</p>
        <p className="text-caption text-faint">
          {[meta, item.dueDate ? `Due ${formatDate(item.dueDate)}` : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      {mutable && (
        <button
          type="button"
          aria-label={`Delete ${label}`}
          onClick={() => toggle.mutate({ kind, id: item.id, remove: true })}
          className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeader title="Milestones" />
        {milestones.isLoading ? (
          <SkeletonList count={2} />
        ) : milestones.isError ? (
          <ErrorState title="Couldn't load milestones" onRetry={() => milestones.refetch()} />
        ) : (
          <Card>
            {milestones.data && milestones.data.length > 0 ? (
              <ol className="divide-y divide-border">
                {[...milestones.data]
                  .sort((a, b) => a.position - b.position)
                  .map((item) => row("milestone", item, item.title))}
              </ol>
            ) : (
              <p className="px-4 py-4 text-caption text-muted">No milestones yet.</p>
            )}
            {mutable && (
              <form
                className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (milestoneTitle.trim().length >= 3) addMilestone.mutate();
                }}
              >
                <label className="sr-only" htmlFor="milestone-title">Milestone</label>
                <Input id="milestone-title" placeholder="Add a milestone (e.g. Samples approved)" maxLength={120} value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} />
                <label className="sr-only" htmlFor="milestone-due">Due date</label>
                <Input id="milestone-due" type="date" className="sm:w-40" value={milestoneDue} onChange={(event) => setMilestoneDue(event.target.value)} />
                <Button type="submit" size="sm" variant="secondary" disabled={milestoneTitle.trim().length < 3} loading={addMilestone.isPending}>
                  Add
                </Button>
              </form>
            )}
          </Card>
        )}
      </section>

      <section>
        <SectionHeader title="Responsibilities" />
        {responsibilities.isLoading ? (
          <SkeletonList count={2} />
        ) : responsibilities.isError ? (
          <ErrorState title="Couldn't load responsibilities" onRetry={() => responsibilities.refetch()} />
        ) : (
          <Card>
            {responsibilities.data && responsibilities.data.length > 0 ? (
              <ul className="divide-y divide-border">
                {responsibilities.data.map((item) =>
                  row("task", item, item.description, item.party === "BRAND" ? "Brand" : "Creator"),
                )}
              </ul>
            ) : (
              <p className="px-4 py-4 text-caption text-muted">Who does what — nothing assigned yet.</p>
            )}
            {mutable && (
              <form
                className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (task.trim().length >= 3) addTask.mutate();
                }}
              >
                <label className="sr-only" htmlFor="task-party">Party</label>
                <Select id="task-party" className="sm:w-32" value={party} onChange={(event) => setParty(event.target.value as DealParty)}>
                  <option value="CREATOR">Creator</option>
                  <option value="BRAND">Brand</option>
                </Select>
                <label className="sr-only" htmlFor="task-description">Responsibility</label>
                <Input id="task-description" placeholder="e.g. Deliver tech pack" maxLength={500} value={task} onChange={(event) => setTask(event.target.value)} />
                <label className="sr-only" htmlFor="task-due">Due date</label>
                <Input id="task-due" type="date" className="sm:w-40" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} />
                <Button type="submit" size="sm" variant="secondary" disabled={task.trim().length < 3} loading={addTask.isPending}>
                  Add
                </Button>
              </form>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}

/* ----------------------------------------------------------- contract */

function ContractCard({ deal, isBrand }: { deal: Deal; isBrand: boolean }) {
  // No contract-by-deal endpoint: match against my contracts (gap doc).
  const contracts = useQuery({
    queryKey: queryKeys.contracts.list({ limit: 100 }),
    queryFn: () => contractsApi.list({ limit: 100 }),
  });
  const contract = contracts.data?.data.find((item) => item.dealId === deal.id);

  if (contracts.isLoading) return <SkeletonList count={1} />;
  if (contract) {
    const status = CONTRACT_STATUS[contract.status];
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileSignature className="size-5 text-accent" aria-hidden />
            <div>
              <p className="font-display text-body font-bold text-fg">Collaboration agreement</p>
              <p className="text-caption text-muted">Version {contract.currentVersionNumber}</p>
            </div>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <Link href={`/contracts/${contract.id}`}>Open contract</Link>
        </Button>
      </Card>
    );
  }
  if (deal.status !== "ACTIVE") {
    return (
      <EmptyState
        icon={<FileSignature className="size-5" aria-hidden />}
        title="No contract yet"
        description="A contract can be drafted once the deal is active."
      />
    );
  }
  return (
    <EmptyState
      icon={<FileSignature className="size-5" aria-hidden />}
      title="No contract yet"
      description={isBrand ? "Draft the agreement for both parties to sign." : "The brand will draft the agreement."}
      action={
        isBrand && (
          <Button asChild size="sm">
            <Link href={`/contracts/new?dealId=${deal.id}`}>Draft contract</Link>
          </Button>
        )
      }
    />
  );
}

/* -------------------------------------------------------------- screen */

export function DealScreen({ dealId }: { dealId: string }) {
  const client = useQueryClient();
  const router = useRouter();
  const session = useSession();
  const me = session.data?.id;
  const deal = useQuery({
    queryKey: queryKeys.deals.detail(dealId),
    queryFn: () => dealsApi.get(dealId),
    retry: (count, error) => !(error instanceof ApiError && (error.isForbidden || error.isNotFound)) && count < 2,
  });
  const brand = useQuery({
    queryKey: queryKeys.brands.detail(deal.data?.brandId ?? ""),
    queryFn: () => brandsApi.get(deal.data!.brandId),
    enabled: !!deal.data,
  });

  const [confirm, setConfirm] = useState<"complete" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const transition = useMutation({
    mutationFn: (action: "complete" | "cancel") =>
      action === "complete" ? dealsApi.complete(dealId) : dealsApi.cancel(dealId, reason.trim() || undefined),
    onSuccess: (updated, action) => {
      setConfirm(null);
      client.setQueryData(queryKeys.deals.detail(dealId), updated);
      void client.invalidateQueries({ queryKey: queryKeys.deals.all });
      toast.success(action === "complete" ? "Deal completed" : "Deal cancelled");
    },
    onError: (error) => toast.error("Couldn't update the deal", apiMessage(error)),
  });

  const message = useMutation({
    mutationFn: () => {
      const other = partyOf(deal.data!, me) === "CREATOR" ? brand.data?.ownerId : deal.data!.creatorId;
      if (!other) throw new Error("missing participant");
      return messagesApi.start({ participantIds: [other], contextType: "DEAL", contextId: dealId });
    },
    onSuccess: (conversation) => router.push(`/messages/${conversation.id}`),
    onError: (error) => toast.error("Couldn't open the conversation", apiMessage(error)),
  });

  if (deal.isLoading) return <LoadingState />;
  if (deal.isError || !deal.data) {
    const hidden = deal.error instanceof ApiError && (deal.error.isForbidden || deal.error.isNotFound);
    return (
      <PageContainer>
        <BackLink href="/deals" />
        <ErrorState
          title={hidden ? "Deal not found" : "Couldn't load this deal"}
          description={hidden ? "It may not exist, or you're not a party to it." : undefined}
          onRetry={hidden ? undefined : () => deal.refetch()}
        />
      </PageContainer>
    );
  }

  const data = deal.data;
  const status = DEAL_STATUS[data.status];
  const health = DEAL_HEALTH[data.health];
  const isBrand = partyOf(data, me) === "BRAND";

  return (
    <PageContainer size="lg">
      <BackLink href="/deals" />
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {data.status === "ACTIVE" && (
              <Badge tone={health.tone} dot>
                {health.label}
              </Badge>
            )}
          </div>
          <h1 className="font-display text-title text-fg lg:text-[1.875rem]">{data.title}</h1>
          <p className="mt-1 text-body text-muted">
            {brand.data ? `${brand.data.name} · ` : ""}You are the {isBrand ? "brand" : "creator"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={message.isPending} disabled={!brand.data} onClick={() => message.mutate()}>
            <MessageCircle className="size-4" aria-hidden /> Message
          </Button>
          {data.status === "ACTIVE" && (
            <Button size="sm" onClick={() => setConfirm("complete")}>
              Mark complete
            </Button>
          )}
          {(data.status === "NEGOTIATING" || data.status === "ACTIVE") && (
            <Button variant="ghost" size="sm" onClick={() => setConfirm("cancel")}>
              Cancel deal
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Tabs defaultValue={data.status === "NEGOTIATING" ? "proposals" : "plan"}>
          <TabsList className="mb-6">
            <TabsTrigger value="proposals">Proposals</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="contract">Contract</TabsTrigger>
          </TabsList>
          <TabsContent value="proposals">
            <Proposals deal={data} me={me} />
          </TabsContent>
          <TabsContent value="plan">
            <Plan deal={data} />
          </TabsContent>
          <TabsContent value="contract">
            <ContractCard deal={data} isBrand={isBrand} />
          </TabsContent>
        </Tabs>

        <aside>
          <Card className="px-5 py-3">
            <Eyebrow className="pt-2 pb-1">Current terms</Eyebrow>
            <KeyValue label="Value" value={data.totalValue !== null ? formatMoney(data.totalValue, data.currency) : "—"} />
            <KeyValue label="Split (brand / creator)" value={splitLabel(data.revenueSplitBrand, data.revenueSplitCreator)} />
            <KeyValue label="Start" value={data.startDate ? formatDate(data.startDate) : "—"} />
            <KeyValue label="End" value={data.endDate ? formatDate(data.endDate) : "—"} />
            {data.activatedAt && <KeyValue label="Activated" value={formatDate(data.activatedAt)} />}
            {data.completedAt && <KeyValue label="Completed" value={formatDate(data.completedAt)} />}
            {data.cancelledAt && <KeyValue label="Cancelled" value={formatDate(data.cancelledAt)} />}
          </Card>
          {data.cancelReason && (
            <p className="mt-3 text-caption text-muted">Cancellation reason: {data.cancelReason}</p>
          )}
          <Link href={`/briefs/${data.briefId}`} className="mt-4 inline-block text-caption font-semibold text-accent">
            View original brief
          </Link>
        </aside>
      </div>

      <ConfirmationDialog
        open={confirm === "complete"}
        onOpenChange={(value) => !value && setConfirm(null)}
        title="Mark this deal complete?"
        description="Confirms that the collaboration has been delivered. This can't be undone."
        confirmLabel="Complete deal"
        loading={transition.isPending}
        onConfirm={() => transition.mutate("complete")}
      />
      <Modal
        open={confirm === "cancel"}
        onOpenChange={(value) => !value && setConfirm(null)}
        title="Cancel this deal?"
        description="Both parties will see the deal as cancelled. This can't be undone."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Keep deal
            </Button>
            <Button variant="danger" loading={transition.isPending} onClick={() => transition.mutate("cancel")}>
              Cancel deal
            </Button>
          </>
        }
      >
        <Field label="Reason" optional>
          {({ id }) => <Textarea id={id} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />}
        </Field>
      </Modal>
    </PageContainer>
  );
}

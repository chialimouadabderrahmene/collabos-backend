"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Globe2, MapPin, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { BackLink, PageContainer } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, Eyebrow, KeyValue, SectionHeader, Tag } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState, SkeletonList } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ConfirmationDialog } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/hooks";
import { APPLICATION_STATUS } from "@/features/deals/status";
import { applicationsApi, type Application } from "@/lib/api/applications";
import { brandsApi } from "@/lib/api/brands";
import { briefsApi, type Brief } from "@/lib/api/briefs";
import { dealsApi } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils/format";
import { applicationSchema, type ApplicationValues } from "@/lib/validation/deals";

export function budgetLabel(brief: Pick<Brief, "budgetMin" | "budgetMax" | "currency">): string | null {
  const { budgetMin: min, budgetMax: max, currency } = brief;
  if (min !== null && max !== null) return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  if (min !== null) return `From ${formatMoney(min, currency)}`;
  if (max !== null) return `Up to ${formatMoney(max, currency)}`;
  return null;
}

/* ------------------------------------------------------ creator side */

function ApplyForm({ brief }: { brief: Brief }) {
  const client = useQueryClient();
  const form = useForm<ApplicationValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { coverMessage: "", proposedBudget: "" },
  });
  const apply = useMutation({
    mutationFn: (values: ApplicationValues) =>
      applicationsApi.apply({
        briefId: brief.id,
        coverMessage: values.coverMessage,
        proposedBudget: values.proposedBudget ? Number(values.proposedBudget) : undefined,
      }),
    onSuccess: () => {
      toast.success("Proposal sent", "The brand will be notified.");
      void client.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error) =>
      form.setError("root", { message: error instanceof ApiError ? error.message : "Couldn't send your proposal." }),
  });
  const { errors } = form.formState;

  return (
    <Card className="p-5">
      <h2 className="font-display text-heading text-fg">Send a proposal</h2>
      <p className="mt-1 mb-4 text-caption text-muted">
        Introduce yourself and how you&apos;d approach this brief.
      </p>
      <form onSubmit={form.handleSubmit((values) => apply.mutate(values))} noValidate className="flex flex-col gap-4">
        <Field label="Cover message" error={errors.coverMessage?.message}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              rows={6}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              placeholder="Our atelier specialises in…"
              {...form.register("coverMessage")}
            />
          )}
        </Field>
        <Field label={`Proposed budget (${brief.currency})`} optional error={errors.proposedBudget?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              inputMode="numeric"
              placeholder="12000"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              {...form.register("proposedBudget")}
            />
          )}
        </Field>
        {errors.root && (
          <p role="alert" className="text-caption text-danger">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" loading={apply.isPending}>
          <Send className="size-4" aria-hidden /> Send proposal
        </Button>
      </form>
    </Card>
  );
}

function MyApplication({ application }: { application: Application }) {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const withdraw = useMutation({
    mutationFn: () => applicationsApi.withdraw(application.id),
    onSuccess: () => {
      setConfirm(false);
      toast.success("Proposal withdrawn");
      void client.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error) => toast.error("Couldn't withdraw", error instanceof ApiError ? error.message : undefined),
  });
  const status = APPLICATION_STATUS[application.status];
  return (
    <Card highlight={application.status === "ACCEPTED"} className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-heading text-fg">Your proposal</h2>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="text-body whitespace-pre-wrap text-fg-2">{application.coverMessage}</p>
      <p className="mt-3 text-caption text-muted">Sent {formatRelative(application.createdAt)}</p>
      {application.status === "ACCEPTED" && (
        <p className="mt-3 text-caption text-accent">
          Accepted — the brand will open a deal with you. It will appear in Deals.
        </p>
      )}
      {application.status === "PENDING" && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setConfirm(true)}>
          Withdraw
        </Button>
      )}
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Withdraw your proposal?"
        description="The brand will no longer see it as pending. You can't re-open it."
        confirmLabel="Withdraw"
        tone="danger"
        loading={withdraw.isPending}
        onConfirm={() => withdraw.mutate()}
      />
    </Card>
  );
}

/* -------------------------------------------------------- brand side */

function ApplicationsReview({ brief }: { brief: Brief }) {
  const client = useQueryClient();
  const applications = useQuery({
    queryKey: queryKeys.briefs.applications(brief.id),
    queryFn: () => applicationsApi.forBrief(brief.id, { limit: 100 }),
  });
  // Deals already opened from these applications (no deal-by-application
  // lookup exists, so match against my deals).
  const deals = useQuery({
    queryKey: queryKeys.deals.list({ limit: 100 }),
    queryFn: () => dealsApi.list({ limit: 100 }),
  });
  const decide = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      accept ? applicationsApi.accept(id) : applicationsApi.reject(id),
    onSuccess: (_result, { accept }) => {
      toast.success(accept ? "Proposal accepted" : "Proposal declined");
      void client.invalidateQueries({ queryKey: queryKeys.briefs.applications(brief.id) });
    },
    onError: (error) => toast.error("Couldn't update", error instanceof ApiError ? error.message : undefined),
  });

  const dealFor = (applicationId: string) => deals.data?.data.find((deal) => deal.applicationId === applicationId);

  return (
    <section>
      <SectionHeader title={`Proposals${applications.data ? ` (${applications.data.total})` : ""}`} />
      {applications.isLoading ? (
        <SkeletonList count={3} />
      ) : applications.isError ? (
        <ErrorState title="Couldn't load proposals" onRetry={() => applications.refetch()} />
      ) : applications.data?.data.length === 0 ? (
        <EmptyState title="No proposals yet" description="Creators and ateliers who apply will appear here." />
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.data?.data.map((application) => {
            const status = APPLICATION_STATUS[application.status];
            const deal = dealFor(application.id);
            return (
              <li key={application.id}>
                <Card className="p-4">
                  <div className="mb-2 flex items-center gap-3">
                    <Avatar name="Applicant" shape="circle" size="sm" />
                    <p className="min-w-0 flex-1 text-caption text-muted">Received {formatRelative(application.createdAt)}</p>
                    {application.proposedBudget !== null && (
                      <span className="tabular text-body font-semibold text-accent">
                        {formatMoney(application.proposedBudget, brief.currency)}
                      </span>
                    )}
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="line-clamp-6 text-body whitespace-pre-wrap text-fg-2">{application.coverMessage}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {application.status === "PENDING" && (
                      <>
                        <Button
                          size="sm"
                          loading={decide.isPending && decide.variables?.id === application.id && decide.variables.accept}
                          onClick={() => decide.mutate({ id: application.id, accept: true })}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={decide.isPending && decide.variables?.id === application.id && !decide.variables.accept}
                          onClick={() => decide.mutate({ id: application.id, accept: false })}
                        >
                          Decline
                        </Button>
                      </>
                    )}
                    {application.status === "ACCEPTED" &&
                      (deal ? (
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/deals/${deal.id}`}>Open deal</Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm">
                          <Link href={`/deals/new?applicationId=${application.id}`}>Start deal</Link>
                        </Button>
                      ))}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- screen */

export function BriefScreen({ briefId }: { briefId: string }) {
  const client = useQueryClient();
  const session = useSession();
  const brief = useQuery({ queryKey: queryKeys.briefs.detail(briefId), queryFn: () => briefsApi.get(briefId) });
  const brand = useQuery({
    queryKey: queryKeys.brands.detail(brief.data?.brandId ?? ""),
    queryFn: () => brandsApi.get(brief.data!.brandId),
    enabled: !!brief.data,
  });
  const isOwner = !!brand.data && brand.data.ownerId === session.data?.id;
  const mine = useQuery({
    queryKey: queryKeys.applications.mine({ limit: 100 }),
    queryFn: () => applicationsApi.mine({ limit: 100 }),
    enabled: !!brand.data && !isOwner,
  });
  const myApplication = mine.data?.data
    .filter((application) => application.briefId === briefId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const [closing, setClosing] = useState(false);
  const close = useMutation({
    mutationFn: () => briefsApi.close(briefId),
    onSuccess: (updated) => {
      setClosing(false);
      client.setQueryData(queryKeys.briefs.detail(briefId), updated);
      toast.success("Brief closed", "It no longer accepts proposals.");
    },
    onError: (error) => toast.error("Couldn't close", error instanceof ApiError ? error.message : undefined),
  });

  if (brief.isLoading) return <LoadingState />;
  if (brief.isError || !brief.data) {
    const missing = brief.error instanceof ApiError && brief.error.isNotFound;
    return (
      <PageContainer>
        <BackLink href="/explore" />
        <ErrorState
          title={missing ? "Brief not found" : "Couldn't load this brief"}
          onRetry={missing ? undefined : () => brief.refetch()}
        />
      </PageContainer>
    );
  }

  const data = brief.data;
  const range = budgetLabel(data);
  const canApply = !isOwner && data.status === "OPEN" && (!myApplication || ["REJECTED", "WITHDRAWN"].includes(myApplication.status));

  return (
    <PageContainer size="lg">
      <BackLink href="/explore" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <article>
          {brand.data && (
            <Link href={`/explore/brands/${brand.data.id}`} className="mb-4 inline-flex items-center gap-2.5">
              <Avatar name={brand.data.name} src={brand.data.logoUrl} size="sm" />
              <span className="text-body font-semibold text-fg-2 hover:text-fg">{brand.data.name}</span>
            </Link>
          )}
          <div className="mb-2 flex items-center gap-2">
            <Eyebrow tone="accent">Brief</Eyebrow>
            <Badge tone={data.status === "OPEN" ? "accent" : "neutral"}>{data.status}</Badge>
          </div>
          <h1 className="font-display text-title text-fg lg:text-[2rem]">{data.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-caption text-fg-2">
            {range && <span className="tabular font-semibold text-accent">{range}</span>}
            <span className="inline-flex items-center gap-1">
              {data.isRemote ? <Globe2 className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
              {data.isRemote ? "Remote" : (data.location ?? "On site")}
            </span>
            {data.applicationDeadline && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden /> Apply by {formatDate(data.applicationDeadline)}
              </span>
            )}
          </div>
          <p className="mt-6 text-body leading-relaxed whitespace-pre-wrap text-fg-2">{data.description}</p>
          {data.deliverables.length > 0 && (
            <section className="mt-8">
              <SectionHeader title="Deliverables" />
              <ul className="flex flex-wrap gap-2">
                {data.deliverables.map((item) => (
                  <li key={item}>
                    <Tag>{item}</Tag>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {isOwner && (
            <div className="mt-10">
              <ApplicationsReview brief={data} />
            </div>
          )}
        </article>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <KeyValue label="Posted" value={formatDate(data.createdAt)} />
            <KeyValue label="Budget" value={range ?? "Open"} />
            <KeyValue label="Currency" value={data.currency} />
          </Card>
          {isOwner ? (
            data.status === "OPEN" && (
              <Button variant="secondary" onClick={() => setClosing(true)}>
                Close brief
              </Button>
            )
          ) : mine.isLoading || brand.isLoading ? (
            <SkeletonList count={1} />
          ) : (
            <>
              {myApplication && <MyApplication application={myApplication} />}
              {canApply && <ApplyForm brief={data} />}
              {!canApply && !myApplication && (
                <p className="text-caption text-muted">This brief is no longer accepting proposals.</p>
              )}
            </>
          )}
        </aside>
      </div>
      <ConfirmationDialog
        open={closing}
        onOpenChange={setClosing}
        title="Close this brief?"
        description="It stops accepting new proposals. Existing proposals stay available."
        confirmLabel="Close brief"
        loading={close.isPending}
        onConfirm={() => close.mutate()}
      />
    </PageContainer>
  );
}

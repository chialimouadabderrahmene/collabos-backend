"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { BackLink, PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { applicationsApi } from "@/lib/api/applications";
import { briefsApi } from "@/lib/api/briefs";
import { dealsApi } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { formatMoney } from "@/lib/utils/format";
import { CURRENCIES, termsSchema, toDealTerms, type TermsValues } from "@/lib/validation/deals";
import { EMPTY_TERMS, TermsFields } from "./terms-fields";

/** Start a deal from an accepted proposal (brand owner). */
export function NewDealForm({ applicationId }: { applicationId: string | null }) {
  const router = useRouter();
  const application = useQuery({
    queryKey: ["applications", applicationId],
    queryFn: () => applicationsApi.get(applicationId as string),
    enabled: !!applicationId,
  });
  const brief = useQuery({
    queryKey: queryKeys.briefs.detail(application.data?.briefId ?? ""),
    queryFn: () => briefsApi.get(application.data!.briefId),
    enabled: !!application.data,
  });

  const [title, setTitle] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const form = useForm<TermsValues>({ resolver: zodResolver(termsSchema), defaultValues: EMPTY_TERMS });

  const create = useMutation({
    mutationFn: (values: TermsValues) =>
      dealsApi.create({
        applicationId: applicationId as string,
        title: (title ?? brief.data?.title)?.trim() || undefined,
        currency: currency ?? brief.data?.currency,
        ...toDealTerms(values),
      }),
    onSuccess: (deal) => {
      toast.success("Deal opened", "Your terms were sent as the first proposal.");
      router.push(`/deals/${deal.id}`);
    },
    onError: (error) =>
      form.setError("root", { message: error instanceof ApiError ? error.message : "Couldn't open the deal." }),
  });

  if (!applicationId) {
    return (
      <PageContainer>
        <BackLink href="/deals" />
        <ErrorState title="Pick an accepted proposal first" description="Open one of your briefs and choose Start deal on an accepted proposal." />
      </PageContainer>
    );
  }
  if (application.isLoading || brief.isLoading) return <LoadingState />;
  if (application.isError || !application.data) {
    return (
      <PageContainer>
        <BackLink href="/deals" />
        <ErrorState title="Proposal not found" description="It may not exist, or you don't have access to it." />
      </PageContainer>
    );
  }
  if (application.data.status !== "ACCEPTED") {
    return (
      <PageContainer>
        <BackLink href={`/briefs/${application.data.briefId}`} />
        <ErrorState title="Accept the proposal first" description="Deals can only be opened from accepted proposals." />
      </PageContainer>
    );
  }

  const effectiveCurrency = currency ?? brief.data?.currency ?? "EUR";
  const { errors } = form.formState;

  return (
    <PageContainer size="sm">
      <BackLink href={`/briefs/${application.data.briefId}`} />
      <PageHeader title="Start a deal" subtitle="Propose the terms. The creator can accept or counter." />
      <Card className="mb-6 p-4">
        <Eyebrow className="mb-1">Accepted proposal</Eyebrow>
        <p className="line-clamp-3 text-body text-fg-2">{application.data.coverMessage}</p>
        {application.data.proposedBudget !== null && (
          <p className="tabular mt-2 text-caption text-accent">
            Proposed budget {formatMoney(application.data.proposedBudget, effectiveCurrency)}
          </p>
        )}
      </Card>
      <form onSubmit={form.handleSubmit((values) => create.mutate(values))} noValidate className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label="Deal title" hint="Defaults to the brief title.">
            {({ id }) => (
              <Input id={id} maxLength={120} value={title ?? brief.data?.title ?? ""} onChange={(event) => setTitle(event.target.value)} />
            )}
          </Field>
          <Field label="Currency">
            {({ id }) => (
              <Select id={id} value={effectiveCurrency} onChange={(event) => setCurrency(event.target.value)}>
                {[...new Set([effectiveCurrency, ...CURRENCIES])].map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <TermsFields form={form} currency={effectiveCurrency} messageLabel="Message to the creator" />
        {errors.root && (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-caption text-danger">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth loading={create.isPending}>
          Open deal
        </Button>
      </form>
    </PageContainer>
  );
}

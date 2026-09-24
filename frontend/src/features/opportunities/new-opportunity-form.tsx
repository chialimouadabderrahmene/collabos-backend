"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { BackLink, PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/display";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { roleAtLeast, useActiveBrand } from "@/features/brands/workspace";
import { aiApi } from "@/lib/api/ai";
import { ApiError } from "@/lib/api/http";
import {
  COLLABORATION_TYPES,
  createOpportunitySchema,
  type CreateOpportunityValues,
} from "@/lib/validation/opportunity";
import { useCreateOpportunity } from "./hooks";

/** Step 1 of Create Opportunity: setup → then straight into the Studio. */
export function NewOpportunityForm() {
  const router = useRouter();
  const create = useCreateOpportunity();
  const { brand, brands, isLoading } = useActiveBrand();
  const editableBrands = brands.filter((item) => roleAtLeast(item.role, "EDITOR"));

  const form = useForm<CreateOpportunityValues>({
    resolver: zodResolver(createOpportunitySchema),
    defaultValues: { brandId: "", title: "", summary: "", collaborationType: "", season: "", notes: "" },
  });

  useEffect(() => {
    const preferred = editableBrands.find((item) => item.id === brand?.id) ?? editableBrands[0];
    if (preferred && !form.getValues("brandId")) {
      form.setValue("brandId", preferred.id);
    }
  }, [brand?.id, editableBrands, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const metadata: Record<string, string> = {};
    if (values.collaborationType) {
      metadata.collaborationType = values.collaborationType;
    }
    if (values.season) {
      metadata.season = values.season;
    }

    let opportunityId: string;
    try {
      const opportunity = await create.mutateAsync({
        brandId: values.brandId,
        title: values.title,
        summary: values.summary || undefined,
        metadata,
      });
      opportunityId = opportunity.id;
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : "Couldn't create the Opportunity.",
      });
      return;
    }

    // Optional: turn founder notes into a proposed structure. The result is
    // a pending suggestion in the Studio's AI panel — never applied here.
    if (values.notes) {
      try {
        await aiApi.structure(opportunityId, { notes: values.notes });
        toast.success("Structure suggestion ready", "Review it in the Studio's AI panel.");
      } catch (error) {
        if (error instanceof ApiError && error.isUnavailable) {
          toast.info("AI isn't configured", "Your notes weren't processed — you can write directly.");
        } else {
          toast.warning("Couldn't generate a structure", "You can retry from the AI panel.");
        }
      }
    }

    router.push(`/opportunities/${opportunityId}/studio`);
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (editableBrands.length === 0) {
    return (
      <PageContainer>
        <BackLink href="/create" />
        <EmptyState
          title="You need a brand you can edit"
          description="Opportunities belong to a brand. Create one, or ask a brand admin for editor access."
          action={
            <Button asChild>
              <Link href="/onboarding?new=1">Create a brand</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <PageContainer size="sm">
      <BackLink href="/create" />
      <PageHeader
        title="New Opportunity"
        subtitle="Set the essentials. You'll shape the editorial in the Studio next."
      />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {editableBrands.length > 1 && (
          <Field label="Brand" error={errors.brandId?.message}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("brandId")}>
                {editableBrands.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <Field label="Title" error={errors.title?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              autoFocus
              placeholder="e.g. AW27 Capsule — Artisan Knitwear Collaboration"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              {...form.register("title")}
            />
          )}
        </Field>

        <Field label="Standfirst" optional hint="One or two sentences that set the scene." error={errors.summary?.message}>
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} rows={3} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("summary")} />
          )}
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Collaboration type" optional>
            {({ id }) => (
              <Select id={id} {...form.register("collaborationType")}>
                <option value="">Select type</option>
                {COLLABORATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Season" optional error={errors.season?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} placeholder="AW27" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("season")} />
            )}
          </Field>
        </div>

        <Card highlight className="p-4">
          <Eyebrow tone="accent" className="mb-1.5 flex items-center gap-1.5">
            <Sparkles className="size-3" aria-hidden /> Start from your notes
          </Eyebrow>
          <p className="mb-3 text-caption text-fg-2">
            Paste ideas, bullet points or references. AI proposes an editorial structure you can
            review — nothing is added until you accept it.
          </p>
          <Field label="Founder notes" optional error={errors.notes?.message}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                rows={5}
                placeholder="Knitwear capsule, Italian atelier, recycled cashmere, drop in Oct…"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                {...form.register("notes")}
              />
            )}
          </Field>
        </Card>

        {errors.root && (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-caption text-danger">
            {errors.root.message}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Continue to Studio <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
    </PageContainer>
  );
}

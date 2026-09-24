"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { BackLink, PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/hooks";
import { useActiveBrand } from "@/features/brands/workspace";
import { briefsApi } from "@/lib/api/briefs";
import { ApiError } from "@/lib/api/http";
import { briefSchema, CURRENCIES, parseDeliverables, type BriefValues } from "@/lib/validation/deals";

/** Post a brief. The backend restricts this to the brand's legal owner. */
export function NewBriefForm() {
  const router = useRouter();
  const session = useSession();
  const { brand, brands, isLoading } = useActiveBrand();
  const owned = brands.filter((item) => item.ownerId === session.data?.id);

  const form = useForm<BriefValues>({
    resolver: zodResolver(briefSchema),
    defaultValues: {
      brandId: "",
      title: "",
      description: "",
      budgetMin: "",
      budgetMax: "",
      currency: "EUR",
      deliverables: "",
      applicationDeadline: "",
      location: "",
      isRemote: true,
    },
  });

  const remote = useWatch({ control: form.control, name: "isRemote" });

  useEffect(() => {
    const preferred = owned.find((item) => item.id === brand?.id) ?? owned[0];
    if (preferred && !form.getValues("brandId")) form.setValue("brandId", preferred.id);
  }, [brand?.id, owned, form]);

  const create = useMutation({
    mutationFn: (values: BriefValues) =>
      briefsApi.create({
        brandId: values.brandId,
        title: values.title,
        description: values.description,
        budgetMin: values.budgetMin ? Number(values.budgetMin) : undefined,
        budgetMax: values.budgetMax ? Number(values.budgetMax) : undefined,
        currency: values.currency,
        deliverables: parseDeliverables(values.deliverables),
        applicationDeadline: values.applicationDeadline
          ? new Date(`${values.applicationDeadline}T23:59:59.000Z`).toISOString()
          : undefined,
        location: values.isRemote ? undefined : values.location || undefined,
        isRemote: values.isRemote,
      }),
    onSuccess: (brief) => {
      toast.success("Brief posted");
      router.push(`/briefs/${brief.id}`);
    },
    onError: (error) =>
      form.setError("root", { message: error instanceof ApiError ? error.message : "Couldn't post the brief." }),
  });

  if (isLoading || session.isLoading) return <LoadingState />;
  if (owned.length === 0) {
    return (
      <PageContainer>
        <BackLink href="/create" />
        <EmptyState
          title="Only brand owners can post briefs"
          description="Ask your brand's owner to post it, or create your own brand."
        />
      </PageContainer>
    );
  }

  const { errors } = form.formState;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageContainer size="sm">
      <BackLink href="/create" />
      <PageHeader title="Post a brief" subtitle="Tell creators and ateliers what you're looking for." />
      <form onSubmit={form.handleSubmit((values) => create.mutate(values))} noValidate className="flex flex-col gap-6">
        {owned.length > 1 && (
          <Field label="Brand" error={errors.brandId?.message}>
            {({ id }) => (
              <Select id={id} {...form.register("brandId")}>
                {owned.map((item) => (
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
            <Input id={id} placeholder="Knitwear atelier for AW27 capsule" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("title")} />
          )}
        </Field>
        <Field label="Description" error={errors.description?.message}>
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} rows={7} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("description")} />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Budget from" optional error={errors.budgetMin?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("budgetMin")} />
            )}
          </Field>
          <Field label="Budget to" optional error={errors.budgetMax?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("budgetMax")} />
            )}
          </Field>
          <Field label="Currency">
            {({ id }) => (
              <Select id={id} {...form.register("currency")}>
                {CURRENCIES.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Deliverables" optional hint="One per line, up to 20.">
          {({ id }) => <Textarea id={id} rows={4} placeholder={"Tech pack\nSampling\n200 units"} {...form.register("deliverables")} />}
        </Field>
        <Field label="Apply by" optional>
          {({ id }) => <Input id={id} type="date" min={today} {...form.register("applicationDeadline")} />}
        </Field>
        <Checkbox label="Remote collaboration" {...form.register("isRemote")} />
        {!remote && (
          <Field label="Location" optional error={errors.location?.message}>
            {({ id }) => <Input id={id} placeholder="Milan, Italy" {...form.register("location")} />}
          </Field>
        )}
        {errors.root && (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-caption text-danger">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth loading={create.isPending}>
          Post brief
        </Button>
      </form>
    </PageContainer>
  );
}

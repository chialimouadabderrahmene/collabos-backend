"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { TermsValues } from "@/lib/validation/deals";

/** Value, revenue split (creator share derived), dates and message. */
export function TermsFields({
  form,
  currency,
  messageLabel = "Message",
}: {
  form: UseFormReturn<TermsValues>;
  currency: string;
  messageLabel?: string;
}) {
  const { errors } = form.formState;
  const brandSplit = useWatch({ control: form.control, name: "revenueSplitBrand" });
  const creatorSplit = brandSplit && /^\d+$/.test(brandSplit) && Number(brandSplit) <= 100 ? 100 - Number(brandSplit) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Total value (${currency})`} optional error={errors.totalValue?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} inputMode="numeric" placeholder="14200" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("totalValue")} />
          )}
        </Field>
        <Field
          label="Brand revenue share (%)"
          optional
          hint={creatorSplit !== null ? `Creator receives ${creatorSplit}%` : "Creator share is the remainder."}
          error={errors.revenueSplitBrand?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input id={id} inputMode="numeric" placeholder="50" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("revenueSplitBrand")} />
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" optional>
          {({ id }) => <Input id={id} type="date" {...form.register("startDate")} />}
        </Field>
        <Field label="End date" optional error={errors.endDate?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="date" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("endDate")} />
          )}
        </Field>
      </div>
      <Field label={messageLabel} optional error={errors.message?.message}>
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} rows={3} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("message")} />
        )}
      </Field>
    </div>
  );
}

export const EMPTY_TERMS: TermsValues = {
  totalValue: "",
  revenueSplitBrand: "",
  startDate: "",
  endDate: "",
  message: "",
};

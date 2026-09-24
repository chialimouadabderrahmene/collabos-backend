"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ImagePlus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { LoadingState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { useMyBrands, useWorkspaceStore } from "@/features/brands/workspace";
import { brandsApi, type MyBrand } from "@/lib/api/brands";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils/cn";
import { countryOptions } from "@/lib/utils/countries";
import {
  brandIdentitySchema,
  brandStrategySchema,
  type BrandIdentityInput,
  type BrandIdentityValues,
  type BrandStrategyInput,
} from "@/lib/validation/brand";

const STEPS = ["Brand identity", "Visuals", "Strategy"] as const;
type Step = 0 | 1 | 2 | 3;

function StepTabs({ step }: { step: Step }) {
  return (
    <ol className="mb-8 flex gap-5 border-b border-border" aria-label="Onboarding progress">
      {STEPS.map((label, index) => {
        const state = index < step ? "done" : index === step ? "current" : "upcoming";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-label uppercase",
              state === "current" && "border-accent text-accent",
              state === "done" && "border-transparent text-fg-2",
              state === "upcoming" && "border-transparent text-faint",
            )}
          >
            {state === "done" && <Check className="size-3" aria-hidden />}
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function RootError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="mt-5 rounded-md border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-caption text-danger">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------- step 1 */

function IdentityStep({ onDone }: { onDone: (brand: MyBrand) => void }) {
  const client = useQueryClient();
  const categories = useQuery({
    queryKey: queryKeys.brands.categories,
    queryFn: brandsApi.categories,
  });
  const countries = useMemo(() => countryOptions(), []);
  const form = useForm<BrandIdentityInput, unknown, BrandIdentityValues>({
    resolver: zodResolver(brandIdentitySchema),
    defaultValues: { name: "", categoryId: "", country: "", instagramHandle: "", websiteUrl: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const brand = await brandsApi.create({
        name: values.name,
        categoryIds: values.categoryId ? [values.categoryId] : undefined,
      });
      const country = countries.find((item) => item.code === values.country)?.name;
      if (country || values.instagramHandle || values.websiteUrl) {
        await brandsApi.updateProfile(brand.id, {
          location: country,
          instagramHandle: values.instagramHandle,
          websiteUrl: values.websiteUrl,
        });
      }
      await client.invalidateQueries({ queryKey: queryKeys.brands.mine });
      onDone({ ...brand, role: "OWNER" });
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : "Could not create your brand.",
      });
    }
  });

  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col">
      <div className="flex flex-col gap-5">
        <Field label="Brand name" error={errors.name?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} placeholder="e.g. Void Studio" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("name")} />
          )}
        </Field>
        <Field label="Category" optional>
          {({ id }) => (
            <Select id={id} disabled={categories.isLoading} {...form.register("categoryId")}>
              <option value="">{categories.isLoading ? "Loading…" : "Select category"}</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Country" optional>
          {({ id }) => (
            <Select id={id} {...form.register("country")}>
              <option value="">Select country</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Instagram" optional error={errors.instagramHandle?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} placeholder="@yourbrand" autoCapitalize="none" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("instagramHandle")} />
          )}
        </Field>
        <Field label="Website" optional error={errors.websiteUrl?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="url" inputMode="url" placeholder="https://yourbrand.com" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("websiteUrl")} />
          )}
        </Field>
      </div>
      <RootError message={errors.root?.message} />
      <div className="mt-auto pt-10">
        <Button type="submit" size="lg" fullWidth loading={form.formState.isSubmitting}>
          Continue
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------- step 2 */

function UploadTile({
  label,
  hint,
  previewUrl,
  aspect,
  onFile,
  busy,
}: {
  label: string;
  hint: string;
  previewUrl: string | null;
  aspect: "square" | "wide";
  onFile: (file: File) => void;
  busy: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-2 text-label text-muted uppercase">{label}</p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={cn(
          "group relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface transition-colors hover:border-accent-line hover:bg-accent-tint/40",
          aspect === "square" ? "aspect-square max-w-40" : "aspect-[16/7]",
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={previewUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 text-center text-caption text-muted group-hover:text-fg-2">
            <ImagePlus className="size-5 text-accent" aria-hidden />
            {busy ? "Uploading…" : hint}
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFile(file);
          }
          event.target.value = "";
        }}
      />
    </div>
  );
}

function VisualsStep({ brand, onDone }: { brand: MyBrand; onDone: () => void }) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const logo = useMutation({ mutationFn: (file: File) => brandsApi.uploadLogo(brand.id, file) });
  const cover = useMutation({ mutationFn: (file: File) => brandsApi.uploadCover(brand.id, file) });

  const upload = (kind: "logo" | "cover", file: File) => {
    const preview = URL.createObjectURL(file);
    const mutation = kind === "logo" ? logo : cover;
    (kind === "logo" ? setLogoPreview : setCoverPreview)(preview);
    mutation.mutate(file, {
      onError: (error) => {
        (kind === "logo" ? setLogoPreview : setCoverPreview)(null);
        toast.error(
          `Couldn't upload the ${kind}`,
          error instanceof ApiError ? error.message : undefined,
        );
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6">
        <UploadTile label="Logo" hint="Square PNG, JPG or WEBP · up to 5 MB" aspect="square" previewUrl={logoPreview} busy={logo.isPending} onFile={(file) => upload("logo", file)} />
        <UploadTile label="Cover" hint="Wide image for your brand page · up to 8 MB" aspect="wide" previewUrl={coverPreview} busy={cover.isPending} onFile={(file) => upload("cover", file)} />
      </div>
      <div className="mt-auto flex flex-col gap-3 pt-10">
        <Button size="lg" fullWidth onClick={onDone} disabled={logo.isPending || cover.isPending}>
          Continue
        </Button>
        <Button variant="ghost" size="md" fullWidth onClick={onDone}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- step 3 */

function StrategyStep({ brand, onDone }: { brand: MyBrand; onDone: () => void }) {
  const form = useForm<BrandStrategyInput>({
    resolver: zodResolver(brandStrategySchema),
    defaultValues: {
      description: brand.profile?.description ?? "",
      foundedYear: brand.profile?.foundedYear ? String(brand.profile.foundedYear) : "",
      contactEmail: brand.profile?.contactEmail ?? "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await brandsApi.updateProfile(brand.id, {
        description: values.description || undefined,
        foundedYear: values.foundedYear ? Number(values.foundedYear) : undefined,
        contactEmail: values.contactEmail || undefined,
      });
      onDone();
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : "Could not save your brand details.",
      });
    }
  });

  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col">
      <div className="flex flex-col gap-5">
        <Field label="What is your brand about?" optional hint="Collaborators see this on your brand profile." error={errors.description?.message}>
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} rows={5} placeholder="Performance footwear with a couture edge…" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("description")} />
          )}
        </Field>
        <Field label="Founded" optional error={errors.foundedYear?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} inputMode="numeric" placeholder="2021" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("foundedYear")} />
          )}
        </Field>
        <Field label="Contact email" optional error={errors.contactEmail?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="email" placeholder="studio@yourbrand.com" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("contactEmail")} />
          )}
        </Field>
      </div>
      <RootError message={errors.root?.message} />
      <div className="mt-auto pt-10">
        <Button type="submit" size="lg" fullWidth loading={form.formState.isSubmitting}>
          Finish setup
        </Button>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------- complete */

function Complete({ brand }: { brand: MyBrand }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <span className="mb-6 flex size-16 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-[0_0_48px_rgba(200,255,0,0.3)]">
        <Check className="size-8" strokeWidth={3} aria-hidden />
      </span>
      <h2 className="font-display text-title">{brand.name} is live</h2>
      <p className="mt-2 max-w-xs text-body text-muted">
        Your studio is ready. Turn your first idea into an editorial Opportunity.
      </p>
      <div className="mt-10 flex w-full flex-col gap-3">
        <Button asChild size="lg" fullWidth>
          <Link href="/opportunities/new">
            <Sparkles className="size-4" aria-hidden /> Create your first Opportunity
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" fullWidth>
          <Link href="/home">
            Go to Home <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- flow */

export function OnboardingFlow() {
  const params = useSearchParams();
  const creatingAnother = params.get("new") === "1";
  const myBrands = useMyBrands();
  const setActiveBrandId = useWorkspaceStore((state) => state.setActiveBrandId);
  const [step, setStep] = useState<Step>(0);
  const [brand, setBrand] = useState<MyBrand | null>(null);

  if (myBrands.isLoading) {
    return <LoadingState label="Preparing your studio" />;
  }

  // Resume: a signed-in user who already owns a brand continues at Visuals
  // instead of creating a duplicate (unless explicitly adding another brand).
  const existing = !creatingAnother ? myBrands.data?.[0] : undefined;
  const current = brand ?? existing ?? null;
  const effectiveStep: Step = step === 0 && current ? 1 : step;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-8 pb-10">
      <header className="mb-8 text-center">
        <Wordmark size="lg" />
        <p className="mt-2 text-caption text-muted">
          {effectiveStep === 3 ? "Setup complete" : "Set up your brand studio"}
        </p>
      </header>

      {effectiveStep < 3 && <StepTabs step={effectiveStep} />}

      {effectiveStep === 0 && (
        <IdentityStep
          onDone={(created) => {
            setBrand(created);
            setActiveBrandId(created.id);
            setStep(1);
          }}
        />
      )}
      {effectiveStep === 1 && current && (
        <VisualsStep brand={current} onDone={() => setStep(2)} />
      )}
      {effectiveStep === 2 && current && (
        <StrategyStep brand={current} onDone={() => setStep(3)} />
      )}
      {effectiveStep === 3 && current && <Complete brand={current} />}
    </div>
  );
}

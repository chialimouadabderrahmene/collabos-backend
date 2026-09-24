"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, ImagePlus, Plus, Rocket, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BackLink, PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone, Card, Chip, Eyebrow, SectionHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState, Pagination, SkeletonList } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmationDialog, Modal } from "@/components/ui/overlays";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/hooks";
import { useActiveBrand } from "@/features/brands/workspace";
import { dealsApi } from "@/lib/api/deals";
import {
  DROP_LIMITS,
  DROP_MEDIA_TYPES,
  dropsApi,
  type Drop,
  type DropPage,
  type DropProduct,
  type DropSeo,
  type DropStatus,
  type DropVisibility,
} from "@/lib/api/drops";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils/format";
import { safeHref } from "@/lib/utils/safe-url";
import { CURRENCIES } from "@/lib/validation/deals";

const apiMessage = (error: unknown) => (error instanceof ApiError ? error.message : undefined);

export const DROP_STATUS: Record<DropStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  PUBLISHED: { label: "Live", tone: "accent" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

const VISIBILITY_COPY: Record<DropVisibility, string> = {
  PUBLIC: "Public — listed and shareable",
  UNLISTED: "Unlisted — anyone with the link",
  PRIVATE: "Private — only your brand",
};

/** Optional text input: "" → undefined so PATCH leaves the field unchanged. */
const orUndefined = (value: string) => (value.trim() === "" ? undefined : value.trim());

/* ---------------------------------------------------------------- list */

const FILTERS: Array<{ value: DropStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Live" },
  { value: "ARCHIVED", label: "Archived" },
];

export function DropsList() {
  const [status, setStatus] = useState<DropStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: queryKeys.drops.list({ status, page }),
    queryFn: () => dropsApi.list({ status: status === "ALL" ? undefined : status, page, limit: 12 }),
  });
  return (
    <PageContainer>
      <PageHeader
        title="Drops"
        subtitle="Launch pages for your collaborations"
        actions={
          <Button asChild size="sm">
            <Link href="/drops/new">
              <Plus className="size-4" aria-hidden /> New drop
            </Link>
          </Button>
        }
      />
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
        <ErrorState title="Couldn't load drops" onRetry={() => query.refetch()} />
      ) : !query.data || query.data.data.length === 0 ? (
        <EmptyState
          icon={<Rocket className="size-5" aria-hidden />}
          title="No drops yet"
          description="Build a launch page with products for a collaboration."
          action={
            <Button asChild size="sm">
              <Link href="/drops/new">Build a drop</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {query.data.data.map((drop) => {
              const badge = DROP_STATUS[drop.status];
              return (
                <li key={drop.id}>
                  <Link href={`/drops/${drop.id}`} className="block h-full">
                    <Card interactive className="h-full p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-body font-bold text-fg">{drop.title}</h3>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </div>
                      {drop.description && <p className="mt-1.5 line-clamp-2 text-caption text-muted">{drop.description}</p>}
                      <p className="mt-3 text-caption text-faint">
                        {drop.status === "SCHEDULED" && drop.publishAt
                          ? `Goes live ${formatDate(drop.publishAt, true)}`
                          : drop.publishedAt
                            ? `Live since ${formatDate(drop.publishedAt)}`
                            : `Updated ${formatRelative(drop.updatedAt)}`}
                      </p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} limit={12} total={query.data.total} onPageChange={setPage} className="mt-4" />
        </>
      )}
    </PageContainer>
  );
}

/* ----------------------------------------------------------------- new */

export function NewDropForm({ dealId: initialDealId }: { dealId: string | null }) {
  const router = useRouter();
  const session = useSession();
  const { brand, brands, isLoading } = useActiveBrand();
  const owned = brands.filter((item) => item.ownerId === session.data?.id);
  const [brandId, setBrandId] = useState<string | null>(null);
  const effectiveBrandId = brandId ?? (owned.find((item) => item.id === brand?.id) ?? owned[0])?.id ?? "";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dealId, setDealId] = useState(initialDealId ?? "");
  const deals = useQuery({
    queryKey: queryKeys.deals.list({ status: "ACTIVE", limit: 100 }),
    queryFn: () => dealsApi.list({ status: "ACTIVE", limit: 100 }),
  });
  const brandDeals = deals.data?.data.filter((deal) => deal.brandId === effectiveBrandId) ?? [];

  const create = useMutation({
    mutationFn: () =>
      dropsApi.create({
        brandId: effectiveBrandId,
        title: title.trim(),
        description: orUndefined(description),
        dealId: dealId || undefined,
      }),
    onSuccess: (drop) => {
      toast.success("Drop created", "Add products and build the launch page.");
      router.push(`/drops/${drop.id}`);
    },
    onError: (error) => toast.error("Couldn't create the drop", apiMessage(error)),
  });

  if (isLoading || session.isLoading) return <LoadingState />;
  if (owned.length === 0) {
    return (
      <PageContainer>
        <BackLink href="/drops" />
        <EmptyState title="Only brand owners can launch drops" description="Create your own brand, or ask your brand's owner." />
      </PageContainer>
    );
  }
  const titleValid = title.trim().length >= DROP_LIMITS.title.min && title.trim().length <= DROP_LIMITS.title.max;

  return (
    <PageContainer size="sm">
      <BackLink href="/drops" />
      <PageHeader title="Build a drop" subtitle="A launch page with products for a collaboration." />
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (titleValid) create.mutate();
        }}
      >
        {owned.length > 1 && (
          <Field label="Brand">
            {({ id }) => (
              <Select id={id} value={effectiveBrandId} onChange={(event) => setBrandId(event.target.value)}>
                {owned.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field
          label="Title"
          error={title && !titleValid ? `Between ${DROP_LIMITS.title.min} and ${DROP_LIMITS.title.max} characters` : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Input id={id} placeholder="AW27 Capsule — Void × Lumen" value={title} aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={(event) => setTitle(event.target.value)} />
          )}
        </Field>
        <Field label="Description" optional>
          {({ id }) => (
            <Textarea id={id} rows={4} maxLength={DROP_LIMITS.description} value={description} onChange={(event) => setDescription(event.target.value)} />
          )}
        </Field>
        <Field label="From deal" optional hint="Link the drop to the collaboration it launches.">
          {({ id }) => (
            <Select id={id} value={dealId} onChange={(event) => setDealId(event.target.value)}>
              <option value="">No deal</option>
              {brandDeals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" size="lg" fullWidth disabled={!titleValid} loading={create.isPending}>
          Create drop
        </Button>
      </form>
    </PageContainer>
  );
}

/* ------------------------------------------------------------ editors */

function DetailsForm({ drop }: { drop: Drop }) {
  const client = useQueryClient();
  const [title, setTitle] = useState(drop.title);
  const [description, setDescription] = useState(drop.description ?? "");
  const save = useMutation({
    mutationFn: () => dropsApi.update(drop.id, { title: title.trim(), description: description.trim() }),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.drops.detail(drop.id), updated);
      toast.success("Saved");
    },
    onError: (error) => toast.error("Couldn't save", apiMessage(error)),
  });
  const dirty = title !== drop.title || description !== (drop.description ?? "");
  const locked = drop.status === "ARCHIVED";
  return (
    <div className="flex flex-col gap-4">
      <Field label="Title">
        {({ id }) => <Input id={id} disabled={locked} maxLength={DROP_LIMITS.title.max} value={title} onChange={(event) => setTitle(event.target.value)} />}
      </Field>
      <Field label="Description" optional>
        {({ id }) => (
          <Textarea id={id} disabled={locked} rows={4} maxLength={DROP_LIMITS.description} value={description} onChange={(event) => setDescription(event.target.value)} />
        )}
      </Field>
      <Button className="self-start" disabled={!dirty || locked || title.trim().length < DROP_LIMITS.title.min} loading={save.isPending} onClick={() => save.mutate()}>
        Save details
      </Button>
    </div>
  );
}

function PageForm({ dropId, page, images }: { dropId: string; page: DropPage; images: string[] }) {
  const client = useQueryClient();
  const [values, setValues] = useState({
    headline: page.headline ?? "",
    subheadline: page.subheadline ?? "",
    heroImageUrl: page.heroImageUrl ?? "",
    bodyContent: page.bodyContent ?? "",
    ctaLabel: page.ctaLabel ?? "",
    ctaUrl: page.ctaUrl ?? "",
  });
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  const ctaInvalid = values.ctaUrl !== "" && !safeHref(values.ctaUrl);
  const save = useMutation({
    mutationFn: () => dropsApi.updatePage(dropId, values),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.drops.page(dropId), updated);
      toast.success("Launch page saved");
    },
    onError: (error) => toast.error("Couldn't save the page", apiMessage(error)),
  });
  return (
    <div className="flex flex-col gap-4">
      <Field label="Headline" optional>
        {({ id }) => <Input id={id} maxLength={DROP_LIMITS.headline} value={values.headline} onChange={set("headline")} />}
      </Field>
      <Field label="Subheadline" optional>
        {({ id }) => <Input id={id} maxLength={DROP_LIMITS.subheadline} value={values.subheadline} onChange={set("subheadline")} />}
      </Field>
      <Field label="Hero image" optional hint={images.length === 0 ? "Upload images in the Media tab first." : undefined}>
        {({ id, describedBy }) => (
          <Select id={id} aria-describedby={describedBy} value={values.heroImageUrl} onChange={set("heroImageUrl")}>
            <option value="">None</option>
            {images.map((url, index) => (
              <option key={url} value={url}>
                Image {index + 1}
              </option>
            ))}
            {values.heroImageUrl && !images.includes(values.heroImageUrl) && (
              <option value={values.heroImageUrl}>Current image</option>
            )}
          </Select>
        )}
      </Field>
      <Field label="Story" optional hint="Plain text. Line breaks are kept.">
        {({ id, describedBy }) => (
          <Textarea id={id} rows={8} aria-describedby={describedBy} maxLength={DROP_LIMITS.body} value={values.bodyContent} onChange={set("bodyContent")} />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field label="Button label" optional>
          {({ id }) => <Input id={id} maxLength={DROP_LIMITS.ctaLabel} placeholder="Shop the drop" value={values.ctaLabel} onChange={set("ctaLabel")} />}
        </Field>
        <Field label="Button link" optional error={ctaInvalid ? "Use a full https:// link" : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="url" maxLength={DROP_LIMITS.url} placeholder="https://" value={values.ctaUrl} aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={set("ctaUrl")} />
          )}
        </Field>
      </div>
      <Button className="self-start" disabled={ctaInvalid} loading={save.isPending} onClick={() => save.mutate()}>
        Save page
      </Button>
    </div>
  );
}

function SeoForm({ dropId, seo }: { dropId: string; seo: DropSeo }) {
  const client = useQueryClient();
  const [metaTitle, setMetaTitle] = useState(seo.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(seo.metaDescription ?? "");
  const [keywords, setKeywords] = useState(seo.keywords.join(", "));
  const save = useMutation({
    mutationFn: () =>
      dropsApi.updateSeo(dropId, {
        metaTitle,
        metaDescription,
        keywords: keywords
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean)
          .slice(0, DROP_LIMITS.keywords),
      }),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.drops.seo(dropId), updated);
      toast.success("SEO saved");
    },
    onError: (error) => toast.error("Couldn't save SEO", apiMessage(error)),
  });
  return (
    <div className="flex flex-col gap-4">
      <Field label="Meta title" optional hint={`${metaTitle.length} / ${DROP_LIMITS.metaTitle}`}>
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} maxLength={DROP_LIMITS.metaTitle} value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} />}
      </Field>
      <Field label="Meta description" optional hint={`${metaDescription.length} / ${DROP_LIMITS.metaDescription}`}>
        {({ id, describedBy }) => (
          <Textarea id={id} aria-describedby={describedBy} rows={3} maxLength={DROP_LIMITS.metaDescription} value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} />
        )}
      </Field>
      <Field label="Keywords" optional hint="Comma separated, up to 20.">
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={keywords} onChange={(event) => setKeywords(event.target.value)} />}
      </Field>
      <Button className="self-start" loading={save.isPending} onClick={() => save.mutate()}>
        Save SEO
      </Button>
    </div>
  );
}

function ProductsEditor({ drop }: { drop: Drop }) {
  const client = useQueryClient();
  const products = useQuery({ queryKey: queryKeys.drops.products(drop.id), queryFn: () => dropsApi.products(drop.id) });
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.drops.products(drop.id) });
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<DropProduct | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", currency: "EUR", sku: "", stock: "" });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const priceValid = /^\d+$/.test(form.price) && Number(form.price) <= 10_000_000;
  const stockValid = form.stock === "" || /^\d+$/.test(form.stock);
  const valid = form.name.trim().length >= 2 && priceValid && stockValid;

  const add = useMutation({
    mutationFn: () =>
      dropsApi.addProduct(drop.id, {
        name: form.name.trim(),
        description: orUndefined(form.description),
        price: Number(form.price),
        currency: form.currency,
        sku: orUndefined(form.sku),
        stockQuantity: form.stock === "" ? undefined : Number(form.stock),
        position: products.data?.length ?? 0,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm({ name: "", description: "", price: "", currency: form.currency, sku: "", stock: "" });
      void invalidate();
    },
    onError: (error) => toast.error("Couldn't add the product", apiMessage(error)),
  });
  const toggle = useMutation({
    mutationFn: (product: DropProduct) => dropsApi.updateProduct(drop.id, product.id, { isAvailable: !product.isAvailable }),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error("Couldn't update", apiMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (productId: string) => dropsApi.removeProduct(drop.id, productId),
    onSuccess: () => {
      setRemoving(null);
      void invalidate();
    },
    onError: (error) => toast.error("Couldn't remove", apiMessage(error)),
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-heading text-fg">Products</h2>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden /> Add product
        </Button>
      </div>
      {products.isLoading ? (
        <SkeletonList count={2} />
      ) : products.isError ? (
        <ErrorState title="Couldn't load products" onRetry={() => products.refetch()} />
      ) : products.data?.length === 0 ? (
        <EmptyState title="No products in this drop" description="Add the pieces this drop launches." />
      ) : (
        <Card className="divide-y divide-border">
          {[...(products.data ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((product) => (
              <div key={product.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-fg">{product.name}</p>
                  <p className="text-caption text-muted">
                    {[product.sku, product.stockQuantity === null ? "Unlimited" : `${product.stockQuantity} in stock`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="tabular text-body font-semibold text-fg">{formatMoney(product.price, product.currency)}</span>
                <Checkbox
                  label={<span className="sr-only">Available: {product.name}</span>}
                  checked={product.isAvailable}
                  onChange={() => toggle.mutate(product)}
                />
                <button
                  type="button"
                  aria-label={`Remove ${product.name}`}
                  onClick={() => setRemoving(product)}
                  className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
        </Card>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Add a product"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!valid} loading={add.isPending} onClick={() => add.mutate()}>
              Add
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">{({ id }) => <Input id={id} maxLength={120} value={form.name} onChange={set("name")} />}</Field>
          <Field label="Description" optional>
            {({ id }) => <Textarea id={id} rows={3} maxLength={2000} value={form.description} onChange={set("description")} />}
          </Field>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Price" error={form.price && !priceValid ? "Whole number" : undefined}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={form.price} onChange={set("price")} />
              )}
            </Field>
            <Field label="Currency">
              {({ id }) => (
                <Select id={id} value={form.currency} onChange={set("currency")}>
                  {CURRENCIES.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU" optional>{({ id }) => <Input id={id} maxLength={60} value={form.sku} onChange={set("sku")} />}</Field>
            <Field label="Stock" optional hint="Blank = unlimited" error={!stockValid ? "Whole number" : undefined}>
              {({ id, describedBy }) => <Input id={id} inputMode="numeric" aria-describedby={describedBy} value={form.stock} onChange={set("stock")} />}
            </Field>
          </div>
        </div>
      </Modal>
      <ConfirmationDialog
        open={!!removing}
        onOpenChange={(value) => !value && setRemoving(null)}
        title="Remove this product?"
        description={removing ? `${removing.name} will be removed from the drop.` : undefined}
        confirmLabel="Remove"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </section>
  );
}

function MediaEditor({ dropId }: { dropId: string }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const media = useQuery({ queryKey: queryKeys.drops.media(dropId), queryFn: () => dropsApi.media(dropId) });
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.drops.media(dropId) });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) await dropsApi.uploadMedia(dropId, file);
    },
    onSuccess: () => void invalidate(),
    onError: (error) => {
      toast.error("Upload failed", apiMessage(error));
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (mediaId: string) => dropsApi.removeMedia(dropId, mediaId),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error("Couldn't remove", apiMessage(error)),
  });

  return (
    <section>
      <input
        ref={input}
        type="file"
        multiple
        accept={DROP_MEDIA_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          const rejected = files.filter((file) => !DROP_MEDIA_TYPES.includes(file.type));
          if (rejected.length) toast.error("Unsupported file", "Use JPEG, PNG, WEBP or MP4.");
          const accepted = files.filter((file) => DROP_MEDIA_TYPES.includes(file.type));
          if (accepted.length) upload.mutate(accepted);
        }}
      />
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-heading text-fg">Media</h2>
        <Button size="sm" variant="secondary" loading={upload.isPending} onClick={() => input.current?.click()}>
          <ImagePlus className="size-4" aria-hidden /> Upload
        </Button>
      </div>
      {media.isLoading ? (
        <SkeletonList count={1} />
      ) : media.isError ? (
        <ErrorState title="Couldn't load media" onRetry={() => media.refetch()} />
      ) : media.data?.length === 0 ? (
        <EmptyState title="No media" description="Images and video for the launch page (JPEG, PNG, WEBP, MP4)." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.data?.map((item) => (
            <li key={item.id} className="group relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-surface-2">
              {item.type === "VIDEO" ? (
                <video src={item.url} className="size-full object-cover" muted playsInline aria-label={item.altText ?? "Drop video"} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- backend-served media
                <img src={item.url} alt={item.altText ?? ""} className="size-full object-cover" loading="lazy" />
              )}
              <button
                type="button"
                aria-label="Remove media"
                onClick={() => remove.mutate(item.id)}
                className="absolute top-2 right-2 rounded-md bg-bg/80 p-1.5 text-fg-2 backdrop-blur-sm hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- screen */

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DropScreen({ dropId }: { dropId: string }) {
  const client = useQueryClient();
  const drop = useQuery({
    queryKey: queryKeys.drops.detail(dropId),
    queryFn: () => dropsApi.get(dropId),
    retry: (count, error) => !(error instanceof ApiError && (error.isForbidden || error.isNotFound)) && count < 2,
  });
  const page = useQuery({ queryKey: queryKeys.drops.page(dropId), queryFn: () => dropsApi.page(dropId), enabled: drop.isSuccess });
  const seo = useQuery({ queryKey: queryKeys.drops.seo(dropId), queryFn: () => dropsApi.seo(dropId), enabled: drop.isSuccess });
  const media = useQuery({ queryKey: queryKeys.drops.media(dropId), queryFn: () => dropsApi.media(dropId), enabled: drop.isSuccess });

  const [dialog, setDialog] = useState<"publish" | "schedule" | "archive" | null>(null);
  const [publishAt, setPublishAt] = useState("");
  const [minPublishAt] = useState(() => toLocalInput(new Date(Date.now() + 5 * 60_000)));
  const transition = useMutation({
    mutationFn: (kind: "publish" | "schedule" | "archive" | DropVisibility) => {
      if (kind === "publish") return dropsApi.publish(dropId);
      if (kind === "archive") return dropsApi.archive(dropId);
      if (kind === "schedule") return dropsApi.schedule(dropId, new Date(publishAt).toISOString());
      return dropsApi.setVisibility(dropId, kind);
    },
    onSuccess: (updated, kind) => {
      setDialog(null);
      client.setQueryData(queryKeys.drops.detail(dropId), updated);
      void client.invalidateQueries({ queryKey: queryKeys.drops.all });
      toast.success(
        kind === "publish" ? "Drop is live" : kind === "schedule" ? "Drop scheduled" : kind === "archive" ? "Drop archived" : "Visibility updated",
      );
    },
    onError: (error) => toast.error("Couldn't update the drop", apiMessage(error)),
  });

  if (drop.isLoading) return <LoadingState />;
  if (drop.isError || !drop.data) {
    const hidden = drop.error instanceof ApiError && (drop.error.isForbidden || drop.error.isNotFound);
    return (
      <PageContainer>
        <BackLink href="/drops" />
        <ErrorState title={hidden ? "Drop not found" : "Couldn't load this drop"} onRetry={hidden ? undefined : () => drop.refetch()} />
      </PageContainer>
    );
  }

  const data = drop.data;
  const badge = DROP_STATUS[data.status];
  const images = media.data?.filter((item) => item.type === "IMAGE").map((item) => item.url) ?? [];
  const publicUrl = `/d/${data.slug}`;
  const viewable = data.status === "PUBLISHED" && data.visibility !== "PRIVATE";
  // Same-format local datetime strings compare chronologically; the backend re-validates.
  const schedulable = publishAt !== "" && publishAt >= minPublishAt;

  return (
    <PageContainer size="lg">
      <BackLink href="/drops" />
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {data.status === "SCHEDULED" && data.publishAt && (
              <span className="inline-flex items-center gap-1 text-caption text-muted">
                <CalendarClock className="size-3.5" aria-hidden /> {formatDate(data.publishAt, true)}
              </span>
            )}
          </div>
          <h1 className="font-display text-title text-fg lg:text-[1.875rem]">{data.title}</h1>
          {data.dealId && (
            <Link href={`/deals/${data.dealId}`} className="mt-1 inline-block text-caption font-semibold text-accent">
              From a deal
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {viewable && (
            <Button asChild variant="secondary" size="sm">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden /> View page
              </a>
            </Button>
          )}
          {(data.status === "DRAFT" || data.status === "SCHEDULED") && (
            <Button size="sm" onClick={() => setDialog("publish")}>
              <Rocket className="size-4" aria-hidden /> Publish now
            </Button>
          )}
          {data.status === "DRAFT" && (
            <Button variant="secondary" size="sm" onClick={() => setDialog("schedule")}>
              Schedule
            </Button>
          )}
          {data.status !== "ARCHIVED" && (
            <Button variant="ghost" size="sm" onClick={() => setDialog("archive")}>
              Archive
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Tabs defaultValue="page">
          <TabsList className="mb-6 overflow-x-auto">
            <TabsTrigger value="page">Page</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>
          <TabsContent value="page">
            {page.isLoading ? <SkeletonList count={3} /> : page.data ? (
              <PageForm key={JSON.stringify(page.data)} dropId={dropId} page={page.data} images={images} />
            ) : (
              <ErrorState title="Couldn't load the page" onRetry={() => page.refetch()} />
            )}
          </TabsContent>
          <TabsContent value="products">
            <ProductsEditor drop={data} />
          </TabsContent>
          <TabsContent value="media">
            <MediaEditor dropId={dropId} />
          </TabsContent>
          <TabsContent value="details">
            <DetailsForm key={data.updatedAt} drop={data} />
          </TabsContent>
          <TabsContent value="seo">
            {seo.isLoading ? <SkeletonList count={3} /> : seo.data ? (
              <SeoForm key={JSON.stringify(seo.data)} dropId={dropId} seo={seo.data} />
            ) : (
              <ErrorState title="Couldn't load SEO" onRetry={() => seo.refetch()} />
            )}
          </TabsContent>
        </Tabs>

        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <Eyebrow className="mb-2">Visibility</Eyebrow>
            <label htmlFor="drop-visibility" className="sr-only">
              Visibility
            </label>
            <Select
              id="drop-visibility"
              value={data.visibility}
              disabled={transition.isPending || data.status === "ARCHIVED"}
              onChange={(event) => transition.mutate(event.target.value as DropVisibility)}
            >
              {(Object.keys(VISIBILITY_COPY) as DropVisibility[]).map((option) => (
                <option key={option} value={option}>
                  {VISIBILITY_COPY[option]}
                </option>
              ))}
            </Select>
            <p className="mt-3 text-caption break-all text-muted">
              Public link: <span className="text-fg-2">{publicUrl}</span>
            </p>
          </Card>
          <SectionHeader title="Timeline" className="mb-0" />
          <Card className="px-4 py-3 text-caption text-muted">
            <p>Created {formatDate(data.createdAt)}</p>
            {data.publishedAt && <p>Published {formatDate(data.publishedAt, true)}</p>}
            {data.archivedAt && <p>Archived {formatDate(data.archivedAt)}</p>}
          </Card>
        </aside>
      </div>

      <ConfirmationDialog
        open={dialog === "publish"}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Publish this drop now?"
        description={data.visibility === "PRIVATE" ? "It's private: only your brand will see it until you change visibility." : "The launch page goes live immediately."}
        confirmLabel="Publish"
        loading={transition.isPending}
        onConfirm={() => transition.mutate("publish")}
      />
      <ConfirmationDialog
        open={dialog === "archive"}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Archive this drop?"
        description="The page goes offline and the drop can no longer be edited."
        confirmLabel="Archive"
        tone="danger"
        loading={transition.isPending}
        onConfirm={() => transition.mutate("archive")}
      />
      <Modal
        open={dialog === "schedule"}
        onOpenChange={(value) => !value && setDialog(null)}
        title="Schedule the launch"
        description="The drop publishes automatically at this time (your local time zone)."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button disabled={!schedulable} loading={transition.isPending} onClick={() => transition.mutate("schedule")}>
              Schedule
            </Button>
          </>
        }
      >
        <Field label="Goes live at" error={publishAt && !schedulable ? "Pick a time in the future" : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="datetime-local" min={minPublishAt} value={publishAt} aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={(event) => setPublishAt(event.target.value)} />
          )}
        </Field>
      </Modal>
    </PageContainer>
  );
}

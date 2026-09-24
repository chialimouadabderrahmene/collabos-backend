"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Minus, Package, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BackLink, PageContainer, PageHeader } from "@/components/navigation/page";
import { Button, IconButton } from "@/components/ui/button";
import { Avatar, Badge, Card, Eyebrow, SectionHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState, Pagination, SkeletonList } from "@/components/ui/feedback";
import { Field, Input, SearchInput, Select, Textarea } from "@/components/ui/field";
import { ConfirmationDialog, Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/hooks";
import { useActiveBrand, useMyBrands } from "@/features/brands/workspace";
import { brandsApi } from "@/lib/api/brands";
import { ApiError } from "@/lib/api/http";
import { CART_MAX_QUANTITY, cartApi } from "@/lib/api/orders";
import {
  PRODUCT_MEDIA_TYPES,
  productsApi,
  type Product,
  type StockMovementType,
  type Variant,
} from "@/lib/api/products";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { useDebounced } from "@/lib/utils/use-debounced";
import { CURRENCIES } from "@/lib/validation/deals";

const apiMessage = (error: unknown) => (error instanceof ApiError ? error.message : undefined);
const isWhole = (value: string, max = 10_000_000) => /^\d+$/.test(value) && Number(value) <= max;
const orUndefined = (value: string) => (value.trim() === "" ? undefined : value.trim());

/** UX hint only: the backend authorizes every catalog change. `resolved`
 * stays false until we know, so the wrong view never flashes. */
function useIsProductOwner(product: Product | undefined) {
  const session = useSession();
  const brands = useMyBrands();
  const resolved = !session.isLoading && !brands.isLoading;
  const isOwner = !!product && !!brands.data?.some((brand) => brand.id === product.brandId && brand.ownerId === session.data?.id);
  return { isOwner, resolved };
}

export function ProductCard({ product, href }: { product: Product; href: string }) {
  const media = useQuery({
    queryKey: queryKeys.products.media(product.id),
    queryFn: () => productsApi.media(product.id),
    staleTime: 5 * 60_000,
  });
  const cover = [...(media.data ?? [])].sort((a, b) => a.position - b.position)[0];
  return (
    <Link href={href} className="group block">
      <div className="mb-2.5 aspect-[4/5] overflow-hidden rounded-lg border border-border bg-surface-2">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- backend-served media
          <img src={cover.url} alt={cover.altText ?? product.name} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <span className="flex size-full items-center justify-center text-faint">
            <Package className="size-8" aria-hidden />
          </span>
        )}
      </div>
      <p className="truncate text-body font-semibold text-fg">{product.name}</p>
      <p className="tabular text-caption text-fg-2">
        {formatMoney(product.price, product.currency)}
        {product.compareAtPrice !== null && product.compareAtPrice > product.price && (
          <span className="ml-1.5 text-faint line-through">{formatMoney(product.compareAtPrice, product.currency)}</span>
        )}
      </p>
    </Link>
  );
}

/* ---------------------------------------------------------------- list */

export function ProductsList() {
  const { brand, isLoading } = useActiveBrand();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const query = useQuery({
    queryKey: queryKeys.products.list({ brandId: brand?.id, page, search, includeInactive: true }),
    queryFn: () => productsApi.list({ brandId: brand!.id, page, limit: 12, search: search || undefined, includeInactive: true }),
    enabled: !!brand,
  });

  return (
    <PageContainer size="lg">
      <PageHeader
        title="Products"
        subtitle={brand ? `Catalog and inventory for ${brand.name}` : undefined}
        actions={
          <Button asChild size="sm">
            <Link href="/products/new">
              <Plus className="size-4" aria-hidden /> New product
            </Link>
          </Button>
        }
      />
      <label htmlFor="product-search" className="sr-only">
        Search products
      </label>
      <div className="mb-5">
        <SearchInput
          id="product-search"
          placeholder="Search products"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            setPage(1);
          }}
        />
      </div>
      {isLoading || query.isLoading ? (
        <SkeletonList count={4} />
      ) : !brand ? (
        <EmptyState title="No brand workspace" description="Create a brand to sell products." />
      ) : query.isError ? (
        <ErrorState title="Couldn't load products" onRetry={() => query.refetch()} />
      ) : !query.data || query.data.data.length === 0 ? (
        <EmptyState
          icon={<Package className="size-5" aria-hidden />}
          title={search ? "No matching products" : "No products yet"}
          description="Add products with sizes and stock, then sell them in your shop."
        />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-body sm:min-w-[36rem]">
              <thead className="border-b border-border text-label text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-normal">Product</th>
                  <th scope="col" className="px-4 py-3 font-normal">Price</th>
                  <th scope="col" className="px-4 py-3 font-normal">Stock</th>
                  <th scope="col" className="px-4 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {query.data.data.map((product) => (
                  <tr key={product.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <Link href={`/products/${product.id}`} className="font-semibold text-fg hover:text-accent">
                        {product.name}
                      </Link>
                      {product.categories.length > 0 && (
                        <p className="text-caption text-muted">{product.categories.map((category) => category.name).join(", ")}</p>
                      )}
                    </td>
                    <td className="tabular px-4 py-3 text-fg-2">{formatMoney(product.price, product.currency)}</td>
                    <td className="tabular px-4 py-3">
                      <span className={product.totalStock === 0 ? "text-danger" : product.totalStock <= 5 ? "text-warning" : "text-fg-2"}>
                        {product.totalStock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={product.isActive ? "accent" : "neutral"}>{product.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={page} limit={12} total={query.data.total} onPageChange={setPage} className="mt-4" />
        </>
      )}
    </PageContainer>
  );
}

/* ----------------------------------------------------------------- new */

export function NewProductForm() {
  const router = useRouter();
  const session = useSession();
  const { brand, brands, isLoading } = useActiveBrand();
  const owned = brands.filter((item) => item.ownerId === session.data?.id);
  const [brandId, setBrandId] = useState<string | null>(null);
  const effectiveBrandId = brandId ?? (owned.find((item) => item.id === brand?.id) ?? owned[0])?.id ?? "";
  const [form, setForm] = useState({ name: "", description: "", price: "", compareAt: "", currency: "EUR" });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const valid =
    form.name.trim().length >= 2 && isWhole(form.price) && (form.compareAt === "" || isWhole(form.compareAt));

  const create = useMutation({
    mutationFn: () =>
      productsApi.create({
        brandId: effectiveBrandId,
        name: form.name.trim(),
        description: orUndefined(form.description),
        price: Number(form.price),
        compareAtPrice: form.compareAt ? Number(form.compareAt) : undefined,
        currency: form.currency,
      }),
    onSuccess: (product) => {
      toast.success("Product created", "Add sizes/colours and stock next.");
      router.push(`/products/${product.id}`);
    },
    onError: (error) => toast.error("Couldn't create the product", apiMessage(error)),
  });

  if (isLoading || session.isLoading) return <LoadingState />;
  if (owned.length === 0) {
    return (
      <PageContainer>
        <BackLink href="/products" />
        <EmptyState title="Only brand owners can add products" />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="sm">
      <BackLink href="/products" />
      <PageHeader title="New product" />
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) create.mutate();
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
        <Field label="Name">{({ id }) => <Input id={id} maxLength={120} value={form.name} onChange={set("name")} />}</Field>
        <Field label="Description" optional>
          {({ id }) => <Textarea id={id} rows={4} maxLength={2000} value={form.description} onChange={set("description")} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price" error={form.price && !isWhole(form.price) ? "Whole number" : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={form.price} onChange={set("price")} />
            )}
          </Field>
          <Field label="Compare-at price" optional hint="Shown struck through.">
            {({ id, describedBy }) => <Input id={id} inputMode="numeric" aria-describedby={describedBy} value={form.compareAt} onChange={set("compareAt")} />}
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
        <Button type="submit" size="lg" fullWidth disabled={!valid} loading={create.isPending}>
          Create product
        </Button>
      </form>
    </PageContainer>
  );
}

/* ------------------------------------------------------- owner editors */

function StockDialog({
  product,
  variant,
  onClose,
}: {
  product: Product;
  variant: Variant | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [type, setType] = useState<StockMovementType>("RESTOCK");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const movements = useQuery({
    queryKey: queryKeys.products.stock(product.id, variant?.id ?? ""),
    queryFn: () => productsApi.stockMovements(product.id, variant!.id),
    enabled: !!variant,
  });
  // RESTOCK/RETURN add stock; ADJUSTMENT may be signed.
  const signed = type === "ADJUSTMENT" ? /^-?\d+$/.test(quantity) : /^\d+$/.test(quantity);
  const delta = signed ? Number(quantity) : 0;
  const next = (variant?.stockQuantity ?? 0) + delta;
  const valid = signed && delta !== 0 && next >= 0;
  const adjust = useMutation({
    mutationFn: () => productsApi.adjustStock(product.id, variant!.id, { type, quantity: delta, reason: orUndefined(reason) }),
    onSuccess: () => {
      toast.success("Stock updated");
      void client.invalidateQueries({ queryKey: queryKeys.products.variants(product.id) });
      void client.invalidateQueries({ queryKey: queryKeys.products.detail(product.id) });
      onClose();
    },
    onError: (error) => toast.error("Couldn't adjust stock", apiMessage(error)),
  });

  return (
    <Modal
      open={!!variant}
      onOpenChange={(value) => !value && onClose()}
      title={`Stock · ${variant?.sku ?? ""}`}
      description={`Currently ${variant?.stockQuantity ?? 0} in stock.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={adjust.isPending} onClick={() => adjust.mutate()}>
            Apply ({next})
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Movement">
            {({ id }) => (
              <Select id={id} value={type} onChange={(event) => setType(event.target.value as StockMovementType)}>
                <option value="RESTOCK">Restock (+)</option>
                <option value="RETURN">Return (+)</option>
                <option value="ADJUSTMENT">Adjustment (±)</option>
              </Select>
            )}
          </Field>
          <Field label="Quantity" error={quantity && !valid ? (next < 0 ? "Stock can't go below 0" : "Whole number") : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} inputMode="numeric" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            )}
          </Field>
        </div>
        <Field label="Reason" optional>
          {({ id }) => <Input id={id} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />}
        </Field>
        {movements.data && movements.data.data.length > 0 && (
          <div>
            <Eyebrow className="mb-2">Recent movements</Eyebrow>
            <ul className="divide-y divide-border rounded-md border border-border text-caption">
              {movements.data.data.map((movement) => (
                <li key={movement.id} className="flex justify-between gap-3 px-3 py-2">
                  <span className="text-fg-2">
                    {movement.type.toLowerCase()} {movement.reason && <span className="text-muted">· {movement.reason}</span>}
                  </span>
                  <span className="tabular shrink-0 text-muted">
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity} · {formatDate(movement.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

function VariantsEditor({ product }: { product: Product }) {
  const client = useQueryClient();
  const variants = useQuery({ queryKey: queryKeys.products.variants(product.id), queryFn: () => productsApi.variants(product.id) });
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: queryKeys.products.variants(product.id) });
    void client.invalidateQueries({ queryKey: queryKeys.products.detail(product.id) });
  };
  const [stockFor, setStockFor] = useState<Variant | null>(null);
  const [form, setForm] = useState({ sku: "", size: "", color: "", price: "", stock: "" });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const valid = form.sku.trim().length >= 1 && (form.price === "" || isWhole(form.price)) && (form.stock === "" || isWhole(form.stock, 1_000_000));
  const add = useMutation({
    mutationFn: () =>
      productsApi.addVariant(product.id, {
        sku: form.sku.trim(),
        size: orUndefined(form.size),
        color: orUndefined(form.color),
        priceOverride: form.price ? Number(form.price) : undefined,
        stockQuantity: form.stock ? Number(form.stock) : undefined,
      }),
    onSuccess: () => {
      setForm({ sku: "", size: "", color: "", price: "", stock: "" });
      invalidate();
    },
    onError: (error) => toast.error("Couldn't add the variant", apiMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (variantId: string) => productsApi.removeVariant(product.id, variantId),
    onSuccess: invalidate,
    onError: (error) => toast.error("Couldn't remove the variant", apiMessage(error)),
  });

  return (
    <section>
      <SectionHeader title="Variants & stock" />
      {variants.isLoading ? (
        <SkeletonList count={2} />
      ) : variants.isError ? (
        <ErrorState title="Couldn't load variants" onRetry={() => variants.refetch()} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-body sm:min-w-[34rem]">
            <thead className="border-b border-border text-label text-muted uppercase">
              <tr>
                <th scope="col" className="px-2.5 py-3 sm:px-4 font-normal">SKU</th>
                <th scope="col" className="px-2.5 py-3 sm:px-4 font-normal">Size / colour</th>
                <th scope="col" className="px-2.5 py-3 sm:px-4 font-normal">Price</th>
                <th scope="col" className="px-2.5 py-3 sm:px-4 font-normal">Stock</th>
                <th scope="col" className="px-2.5 py-3 sm:px-4"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {variants.data?.map((variant) => (
                <tr key={variant.id}>
                  <td className="px-2.5 py-3 sm:px-4 font-semibold text-fg">{variant.sku}</td>
                  <td className="px-2.5 py-3 sm:px-4 text-fg-2">{[variant.size, variant.color].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="tabular px-2.5 py-3 sm:px-4 text-fg-2">{formatMoney(variant.effectivePrice, product.currency)}</td>
                  <td className="tabular px-2.5 py-3 sm:px-4">
                    <button type="button" onClick={() => setStockFor(variant)} className="font-semibold text-accent hover:text-accent-hover">
                      {variant.stockQuantity}
                      <span className="sr-only"> — adjust stock for {variant.sku}</span>
                    </button>
                  </td>
                  <td className="px-2.5 py-3 sm:px-4 text-right">
                    <button
                      type="button"
                      aria-label={`Remove variant ${variant.sku}`}
                      onClick={() => remove.mutate(variant.id)}
                      className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
              {variants.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-caption text-muted">
                    Add at least one variant — buyers purchase a specific SKU.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <form
            className="grid grid-cols-2 gap-2 border-t border-border p-3 sm:grid-cols-[1fr_6rem_6rem_6rem_5rem_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid) add.mutate();
            }}
          >
            <Input aria-label="SKU" placeholder="SKU" maxLength={60} value={form.sku} onChange={set("sku")} />
            <Input aria-label="Size" placeholder="Size" maxLength={20} value={form.size} onChange={set("size")} />
            <Input aria-label="Colour" placeholder="Colour" maxLength={40} value={form.color} onChange={set("color")} />
            <Input aria-label="Price override" placeholder="Price" inputMode="numeric" value={form.price} onChange={set("price")} />
            <Input aria-label="Initial stock" placeholder="Stock" inputMode="numeric" value={form.stock} onChange={set("stock")} />
            <Button type="submit" size="sm" variant="secondary" disabled={!valid} loading={add.isPending}>
              Add
            </Button>
          </form>
        </Card>
      )}
      <StockDialog key={stockFor?.id ?? "none"} product={product} variant={stockFor} onClose={() => setStockFor(null)} />
    </section>
  );
}

function MediaEditor({ productId }: { productId: string }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const media = useQuery({ queryKey: queryKeys.products.media(productId), queryFn: () => productsApi.media(productId) });
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.products.media(productId) });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) await productsApi.uploadMedia(productId, file);
    },
    onSettled: () => void invalidate(),
    onError: (error) => toast.error("Upload failed", apiMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (mediaId: string) => productsApi.removeMedia(productId, mediaId),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error("Couldn't remove", apiMessage(error)),
  });
  return (
    <section>
      <input
        ref={input}
        type="file"
        multiple
        accept={PRODUCT_MEDIA_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          const accepted = files.filter((file) => PRODUCT_MEDIA_TYPES.includes(file.type));
          if (accepted.length < files.length) toast.error("Unsupported file", "Use JPEG, PNG or WEBP.");
          if (accepted.length) upload.mutate(accepted);
        }}
      />
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-heading text-fg">Images</h2>
        <Button size="sm" variant="secondary" loading={upload.isPending} onClick={() => input.current?.click()}>
          <ImagePlus className="size-4" aria-hidden /> Upload
        </Button>
      </div>
      {media.data && media.data.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {[...media.data]
            .sort((a, b) => a.position - b.position)
            .map((item) => (
              <li key={item.id} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- backend-served media */}
                <img src={item.url} alt={item.altText ?? ""} className="size-full object-cover" loading="lazy" />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => remove.mutate(item.id)}
                  className="absolute top-1.5 right-1.5 rounded-md bg-bg/80 p-1 text-fg-2 backdrop-blur-sm hover:text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
        </ul>
      ) : (
        !media.isLoading && <p className="text-caption text-muted">No images yet.</p>
      )}
    </section>
  );
}

function OwnerProductView({ product }: { product: Product }) {
  const client = useQueryClient();
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    price: String(product.price),
    compareAt: product.compareAtPrice === null ? "" : String(product.compareAtPrice),
  });
  const [confirm, setConfirm] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const valid = form.name.trim().length >= 2 && isWhole(form.price) && (form.compareAt === "" || isWhole(form.compareAt));
  const save = useMutation({
    mutationFn: () =>
      productsApi.update(product.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        compareAtPrice: form.compareAt ? Number(form.compareAt) : undefined,
      }),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.products.detail(product.id), updated);
      void client.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success("Product saved");
    },
    onError: (error) => toast.error("Couldn't save", apiMessage(error)),
  });
  const deactivate = useMutation({
    mutationFn: () => productsApi.deactivate(product.id),
    onSuccess: () => {
      setConfirm(false);
      void client.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success("Product deactivated", "It's hidden from your shop.");
    },
    onError: (error) => toast.error("Couldn't deactivate", apiMessage(error)),
  });

  return (
    <PageContainer size="lg">
      <BackLink href="/products" />
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Badge tone={product.isActive ? "accent" : "neutral"}>{product.isActive ? "Active" : "Inactive"}</Badge>
          <h1 className="mt-2 font-display text-title text-fg">{product.name}</h1>
          <p className="mt-1 text-body text-muted">{product.totalStock} in stock across variants</p>
        </div>
        {product.isActive && (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
            Deactivate
          </Button>
        )}
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-10">
          <VariantsEditor product={product} />
          <MediaEditor productId={product.id} />
        </div>
        <aside>
          <Card className="flex flex-col gap-4 p-5">
            <Field label="Name">{({ id }) => <Input id={id} maxLength={120} value={form.name} onChange={set("name")} />}</Field>
            <Field label="Description" optional>
              {({ id }) => <Textarea id={id} rows={5} maxLength={2000} value={form.description} onChange={set("description")} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Price (${product.currency})`}>
                {({ id }) => <Input id={id} inputMode="numeric" value={form.price} onChange={set("price")} />}
              </Field>
              <Field label="Compare at" optional>
                {({ id }) => <Input id={id} inputMode="numeric" value={form.compareAt} onChange={set("compareAt")} />}
              </Field>
            </div>
            <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </Card>
        </aside>
      </div>
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Deactivate this product?"
        description="It will be hidden from your shop and can't be added to carts."
        confirmLabel="Deactivate"
        tone="danger"
        loading={deactivate.isPending}
        onConfirm={() => deactivate.mutate()}
      />
    </PageContainer>
  );
}

/* ------------------------------------------------------- shopper view */

function ShopperProductView({ product }: { product: Product }) {
  const client = useQueryClient();
  const cart = useQuery({ queryKey: queryKeys.cart, queryFn: cartApi.get });
  const bagCount = cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const variants = useQuery({ queryKey: queryKeys.products.variants(product.id), queryFn: () => productsApi.variants(product.id) });
  const media = useQuery({ queryKey: queryKeys.products.media(product.id), queryFn: () => productsApi.media(product.id) });
  const brand = useQuery({ queryKey: queryKeys.brands.detail(product.brandId), queryFn: () => brandsApi.get(product.brandId) });
  const available = variants.data?.filter((variant) => variant.isActive) ?? [];
  const [variantId, setVariantId] = useState<string | null>(null);
  const selected = available.find((variant) => variant.id === variantId) ?? available.find((variant) => variant.stockQuantity > 0) ?? null;
  const [quantity, setQuantity] = useState(1);
  const images = [...(media.data ?? [])].sort((a, b) => a.position - b.position);
  const [imageIndex, setImageIndex] = useState(0);
  const maxQuantity = Math.min(selected?.stockQuantity ?? 0, CART_MAX_QUANTITY);

  const add = useMutation({
    mutationFn: () => cartApi.add(selected!.id, quantity),
    onSuccess: (cart) => {
      client.setQueryData(queryKeys.cart, cart);
      toast.success("Added to bag");
    },
    onError: (error) => toast.error("Couldn't add to bag", apiMessage(error)),
  });

  if (!product.isActive) {
    return (
      <PageContainer>
        <BackLink href="/explore" />
        <EmptyState title="This product isn't available" />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg">
      <BackLink href={brand.data ? `/explore/brands/${brand.data.id}` : "/explore"} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2">
        <div>
          <div className="aspect-[4/5] overflow-hidden rounded-xl border border-border bg-surface-2">
            {images[imageIndex] ? (
              // eslint-disable-next-line @next/next/no-img-element -- backend-served media
              <img src={images[imageIndex].url} alt={images[imageIndex].altText ?? product.name} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-faint">
                <Package className="size-10" aria-hidden />
              </span>
            )}
          </div>
          {images.length > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((image, index) => (
                <li key={image.id}>
                  <button
                    type="button"
                    aria-label={`Show image ${index + 1}`}
                    aria-pressed={index === imageIndex}
                    onClick={() => setImageIndex(index)}
                    className={`size-16 overflow-hidden rounded-md border ${index === imageIndex ? "border-accent" : "border-border"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- backend-served media */}
                    <img src={image.url} alt="" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          {brand.data && (
            <Link href={`/explore/brands/${brand.data.id}`} className="mb-3 inline-flex items-center gap-2">
              <Avatar name={brand.data.name} src={brand.data.logoUrl} size="sm" />
              <span className="text-body font-semibold text-fg-2">{brand.data.name}</span>
            </Link>
          )}
          <h1 className="font-display text-title text-fg lg:text-[2rem]">{product.name}</h1>
          <p className="tabular mt-2 font-display text-heading text-accent">
            {formatMoney(selected?.effectivePrice ?? product.price, product.currency)}
            {product.compareAtPrice !== null && product.compareAtPrice > product.price && (
              <span className="ml-2 text-body text-faint line-through">{formatMoney(product.compareAtPrice, product.currency)}</span>
            )}
          </p>
          {product.description && <p className="mt-5 text-body leading-relaxed whitespace-pre-wrap text-fg-2">{product.description}</p>}

          {variants.isLoading ? (
            <SkeletonList count={1} className="mt-6" />
          ) : available.length === 0 ? (
            <p className="mt-6 text-body text-muted">Currently unavailable.</p>
          ) : (
            <fieldset className="mt-6">
              <legend className="mb-2 text-label text-muted uppercase">Option</legend>
              <div className="flex flex-wrap gap-2">
                {available.map((variant) => {
                  const soldOut = variant.stockQuantity === 0;
                  const active = selected?.id === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={soldOut}
                      aria-pressed={active}
                      onClick={() => {
                        setVariantId(variant.id);
                        setQuantity(1);
                      }}
                      className={`h-10 min-w-12 rounded-md border px-3 text-caption font-semibold transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${
                        active ? "border-accent bg-accent text-accent-ink" : "border-border bg-surface text-fg-2 hover:border-border-strong"
                      }`}
                    >
                      {[variant.size, variant.color].filter(Boolean).join(" / ") || variant.sku}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {selected && (
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center rounded-md border border-border" role="group" aria-label="Quantity">
                <IconButton variant="ghost" size="sm" label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}>
                  <Minus className="size-4" aria-hidden />
                </IconButton>
                <span className="tabular w-8 text-center text-body font-semibold" aria-live="polite">
                  {quantity}
                </span>
                <IconButton variant="ghost" size="sm" label="Increase quantity" disabled={quantity >= maxQuantity} onClick={() => setQuantity((value) => value + 1)}>
                  <Plus className="size-4" aria-hidden />
                </IconButton>
              </div>
              <Button size="lg" className="flex-1" loading={add.isPending} disabled={maxQuantity === 0} onClick={() => add.mutate()}>
                <ShoppingBag className="size-4" aria-hidden /> Add to bag
              </Button>
            </div>
          )}
          {selected && selected.stockQuantity <= 5 && selected.stockQuantity > 0 && (
            <p className="mt-2 text-caption text-warning">Only {selected.stockQuantity} left</p>
          )}
          {bagCount > 0 && (
            <Link href="/cart" className="mt-4 inline-flex items-center gap-1.5 text-body font-semibold text-accent hover:text-accent-hover">
              <ShoppingBag className="size-4" aria-hidden /> View bag ({bagCount})
            </Link>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

/* -------------------------------------------------------------- screen */

export function ProductScreen({ productId }: { productId: string }) {
  const product = useQuery({ queryKey: queryKeys.products.detail(productId), queryFn: () => productsApi.get(productId) });
  const { isOwner, resolved } = useIsProductOwner(product.data);
  if (product.isLoading || !resolved) return <LoadingState />;
  if (product.isError || !product.data) {
    return (
      <PageContainer>
        <BackLink href="/explore" />
        <ErrorState title="Product not found" />
      </PageContainer>
    );
  }
  return isOwner ? (
    <OwnerProductView key={product.data.updatedAt} product={product.data} />
  ) : (
    <ShopperProductView product={product.data} />
  );
}

/** Active products of a brand, for its public profile. */
export function BrandShop({ brandId }: { brandId: string }) {
  const products = useQuery({
    queryKey: queryKeys.products.list({ brandId, limit: 8 }),
    queryFn: () => productsApi.list({ brandId, limit: 8 }),
  });
  if (!products.data || products.data.data.length === 0) return null;
  return (
    <section className="mt-8">
      <SectionHeader title="Shop" />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {products.data.data.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} href={`/products/${product.id}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

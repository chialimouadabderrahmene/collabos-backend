import { ArrowRight, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { Avatar, Eyebrow } from "@/components/ui/display";
import { fetchPublicDrop } from "@/lib/api/drops.server";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { safeHref } from "@/lib/utils/safe-url";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicDrop(slug);
  if (result.status !== "ok") return { title: "Drop", robots: { index: false } };
  const { drop, seo, page } = result.data;
  const title = seo.metaTitle || page.headline || drop.title;
  const description = seo.metaDescription || page.subheadline || drop.description || undefined;
  return {
    title,
    description,
    keywords: seo.keywords.length ? seo.keywords : undefined,
    // Unlisted drops are reachable by link but must not be indexed.
    robots: drop.visibility === "PUBLIC" ? undefined : { index: false, follow: false },
    openGraph: { title, description, images: seo.ogImageUrl ? [seo.ogImageUrl] : page.heroImageUrl ? [page.heroImageUrl] : undefined },
  };
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="mb-6 flex size-14 items-center justify-center rounded-xl border border-border bg-surface text-muted">
        <Rocket className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-title">{title}</h1>
      <p className="mt-2 text-body text-muted">{body}</p>
      <Link href="/" className="mt-10">
        <Wordmark size="sm" />
      </Link>
    </div>
  );
}

/** Public launch page for a published drop. */
export default async function PublicDropPage({ params }: Props) {
  const { slug } = await params;
  const result = await fetchPublicDrop(slug);
  if (result.status === "unavailable") {
    return <Message title="This drop isn't available" body="It may not be live yet, or it was taken down." />;
  }
  if (result.status === "error") {
    return <Message title="Something went wrong" body="We couldn't load this drop. Please try again shortly." />;
  }

  const { drop, page, media, products, brand } = result.data;
  const hero = page.heroImageUrl ?? media.find((item) => item.type === "IMAGE")?.url ?? null;
  const gallery = media.filter((item) => item.url !== hero);
  const cta = safeHref(page.ctaUrl);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
        {brand ? (
          <span className="flex items-center gap-2.5">
            <Avatar name={brand.name} src={brand.logoUrl} size="sm" />
            <span className="text-body font-semibold text-fg">{brand.name}</span>
          </span>
        ) : (
          <span />
        )}
        <Link href="/" aria-label="CollabOS">
          <Wordmark size="sm" />
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-8 px-5 pt-6 pb-12 lg:grid-cols-2 lg:items-center lg:px-8 lg:pt-12">
          <div>
            <Eyebrow tone="accent" className="mb-3">
              {drop.publishedAt ? `Dropped ${formatDate(drop.publishedAt)}` : "New drop"}
            </Eyebrow>
            <h1 className="font-display text-[2.5rem] leading-[1.05] font-bold tracking-tight text-fg lg:text-[3.5rem]">
              {page.headline || drop.title}
            </h1>
            {(page.subheadline || drop.description) && (
              <p className="mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-fg-2">{page.subheadline || drop.description}</p>
            )}
            {cta && page.ctaLabel && (
              <a
                href={cta}
                rel="noopener noreferrer"
                className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 text-body font-bold text-accent-ink transition-colors hover:bg-accent-hover"
              >
                {page.ctaLabel} <ArrowRight className="size-4" aria-hidden />
              </a>
            )}
          </div>
          {hero && (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element -- backend-served media */}
              <img src={hero} alt="" className="aspect-[4/5] w-full object-cover" />
            </div>
          )}
        </section>

        {page.bodyContent && (
          <section className="mx-auto max-w-3xl px-5 pb-12 lg:px-8">
            {/* Plain text only — never interpreted as HTML. */}
            <p className="text-[1.0625rem] leading-relaxed whitespace-pre-wrap text-fg-2">{page.bodyContent}</p>
          </section>
        )}

        {products.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 pb-12 lg:px-8" aria-labelledby="drop-products">
            <h2 id="drop-products" className="mb-5 font-display text-heading text-fg">
              The collection
            </h2>
            <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {products.map((product) => (
                <li key={product.id} className="rounded-lg border border-border bg-surface p-4">
                  <p className="font-display text-body font-bold text-fg">{product.name}</p>
                  {product.description && <p className="mt-1 line-clamp-3 text-caption text-muted">{product.description}</p>}
                  <p className="tabular mt-3 text-body font-semibold text-accent">{formatMoney(product.price, product.currency)}</p>
                  {product.stockQuantity !== null && product.stockQuantity <= 10 && (
                    <p className="mt-1 text-caption text-warning">
                      {product.stockQuantity === 0 ? "Sold out" : `Only ${product.stockQuantity} left`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {gallery.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 pb-16 lg:px-8" aria-label="Gallery">
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {gallery.map((item) => (
                <li key={item.id} className="overflow-hidden rounded-lg border border-border">
                  {item.type === "VIDEO" ? (
                    <video src={item.url} controls playsInline className="aspect-[4/5] w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- backend-served media
                    <img src={item.url} alt={item.altText ?? ""} loading="lazy" className="aspect-[4/5] w-full object-cover" />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer className="border-t border-border py-8 text-center text-caption text-faint">
        Launched with <Link href="/" className="text-fg-2 hover:text-fg">CollabOS</Link>
      </footer>
    </div>
  );
}

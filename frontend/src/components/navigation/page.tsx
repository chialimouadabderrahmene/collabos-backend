"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Width-constrained page body. Mobile-first single column (matching the
 * phone references); wider layouts opt in via `size`. */
export function PageContainer({
  size = "md",
  className,
  children,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  children: ReactNode;
}) {
  const widths = { sm: "max-w-xl", md: "max-w-3xl", lg: "max-w-5xl", xl: "max-w-7xl" } as const;
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pt-5 pb-24 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16",
        widths[size],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Back affordance ("← Back") used at the top of detail screens. Falls back
 * to `href` when there is no history (deep link). */
export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
      className="mb-4 inline-flex items-center gap-1.5 text-caption font-semibold text-muted transition-colors hover:text-fg"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 hidden lg:block">
      <ol className="flex items-center gap-1.5 text-caption text-faint">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="size-3" aria-hidden />}
            {item.href ? (
              <Link href={item.href} className="hover:text-fg-2">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-muted">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Screen title block: small eyebrow ("Good morning"), bold title, subtitle
 * and right-aligned actions — the header pattern across the references. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-caption text-muted">{eyebrow}</p>}
        <h1 className="font-display text-title text-fg lg:text-[1.875rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-body text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { monogram } from "@/lib/utils/format";

/* ------------------------------------------------------------------ Badge */

export type BadgeTone = "accent" | "neutral" | "success" | "warning" | "danger" | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  accent: "bg-accent-tint text-accent border-accent-line",
  neutral: "bg-surface-2 text-fg-2 border-border",
  success: "bg-success-tint text-success border-success/25",
  warning: "bg-warning-tint text-warning border-warning/25",
  danger: "bg-danger-tint text-danger border-danger/25",
  info: "bg-info-tint text-info border-info/25",
};

/** Small uppercase status pill ("VERIFIED", "ACTIVE DEAL", "LIVE"). */
export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[0.625rem] leading-none font-bold tracking-[0.08em] uppercase",
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Avatar */

const AVATAR_TONES = [
  "bg-accent text-accent-ink",
  "bg-[#705000] text-[#ffd76a]",
  "bg-[#285080] text-[#cfe3ff]",
  "bg-[#006634] text-[#aef5cf]",
  "bg-[#6a1f58] text-[#ffc2ec]",
] as const;

function toneFor(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** Square monogram avatar ("MC", "KA") or image. Brand = rounded square,
 * person = circle, matching the references. */
export function Avatar({
  name,
  src,
  size = "md",
  shape = "square",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "square" | "circle";
  className?: string;
}) {
  const sizes = {
    xs: "size-6 text-[0.5625rem]",
    sm: "size-8 text-[0.6875rem]",
    md: "size-10 text-caption",
    lg: "size-14 text-body",
    xl: "size-20 text-heading",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden font-display font-bold tracking-tight",
        shape === "circle" ? "rounded-full" : "rounded-md",
        sizes[size],
        !src && toneFor(name),
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed/remote URLs, sizes vary
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span aria-label={name}>{monogram(name)}</span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------- Card */

export function Card({
  className,
  highlight = false,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { highlight?: boolean; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-surface",
        highlight ? "border-accent-line bg-accent-tint/60" : "border-border",
        interactive &&
          "transition-colors duration-150 hover:border-border-strong hover:bg-surface-2/60",
        className,
      )}
      {...props}
    />
  );
}

/* --------------------------------------------------------------- Section */

/** "Top Matches ········ See all →" section heading used across screens. */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)}>
      <h2 className="font-display text-heading text-fg">{title}</h2>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-1 text-caption font-semibold text-accent hover:text-accent-hover"
        >
          {action.label}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Progress */

/** Slim lime bar with trailing percentage ("Match 87%"). */
export function Progress({
  value,
  label,
  showValue = true,
  tone = "accent",
  className,
}: {
  value: number;
  label?: string;
  showValue?: boolean;
  tone?: "accent" | "warning" | "danger";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const fill = { accent: "bg-accent", warning: "bg-warning", danger: "bg-danger" }[tone];
  const text = { accent: "text-accent", warning: "text-warning", danger: "text-danger" }[tone];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", fill)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showValue && (
        <span className={cn("tabular text-caption font-bold", text)}>{clamped}%</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Chip */

/** Filter chip ("All", "Clothing", "Footwear"); lime when selected. */
export function Chip({
  selected = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { selected?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-caption font-semibold transition-colors duration-150",
        selected
          ? "border-accent bg-accent text-accent-ink"
          : "border-border bg-surface text-fg-2 hover:border-border-strong hover:text-fg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Static tag ("OUTERWEAR", "SUSTAINABLE") under brand cards. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm border border-border bg-surface-2 px-2 text-[0.625rem] font-bold tracking-[0.08em] text-muted uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- KPI */

/** Compact metric tile: big number, small caption ("2 Active deals"). */
export function Stat({
  value,
  label,
  hint,
  accent = false,
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-3.5", className)}>
      <div
        className={cn(
          "tabular font-display text-kpi",
          accent ? "text-accent" : "text-fg",
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 text-caption text-muted">{label}</div>
      {hint && <div className="mt-1 text-[0.6875rem] font-semibold text-accent">{hint}</div>}
    </div>
  );
}

/** Label/value row used in detail cards ("Revenue split ····· 50 / 50"). */
export function KeyValue({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-border py-2.5 text-body last:border-b-0",
        className,
      )}
    >
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold text-fg">{value}</span>
    </div>
  );
}

/** Uppercase eyebrow ("ACTIVE DEAL", "WHY YOU MATCH"). */
export function Eyebrow({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "accent";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-label uppercase",
        tone === "accent" ? "text-accent" : "text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}

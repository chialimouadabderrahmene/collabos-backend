import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} />;
}

/** Card-shaped skeleton list used while collections load. */
export function SkeletonList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingState({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn("flex min-h-40 flex-col items-center justify-center gap-3 text-muted", className)}
    >
      <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
      <span className="text-caption">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-accent-tint text-accent">
          {icon}
        </div>
      )}
      <p className="font-display text-heading text-fg">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-body text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-danger/25 bg-danger-tint px-6 py-8 text-center",
        className,
      )}
    >
      <AlertTriangle className="mb-3 size-5 text-danger" aria-hidden />
      <p className="font-display text-heading text-fg">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-body text-fg-2">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  total,
  limit,
  onPageChange,
  className,
}: {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) {
    return null;
  }
  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-3 pt-2", className)}
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden /> Previous
      </Button>
      <span className="tabular text-caption text-muted">
        Page <span className="text-fg">{page}</span> of {pages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        Next <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}

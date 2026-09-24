import { ArrowUpRight, Layers } from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/display";
import type { Opportunity, OpportunityStatus } from "@/lib/api/opportunities";
import { cn } from "@/lib/utils/cn";
import { formatRelative } from "@/lib/utils/format";

const STATUS: Record<OpportunityStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PUBLISHED: { label: "Published", tone: "accent" },
  ARCHIVED: { label: "Archived", tone: "warning" },
};

export function OpportunityStatusBadge({ status }: { status: OpportunityStatus }) {
  const { label, tone } = STATUS[status];
  return (
    <Badge tone={tone} dot={status === "PUBLISHED"}>
      {label}
    </Badge>
  );
}

/** Compact editorial card for an Opportunity: status, title, summary and
 * publication meta. Links to the Studio (editable) or detail (read-only). */
export function OpportunityCard({
  opportunity,
  className,
}: {
  opportunity: Opportunity;
  className?: string;
}) {
  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      className={cn(
        "group flex flex-col rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2/60",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <OpportunityStatusBadge status={opportunity.status} />
        <ArrowUpRight
          className="size-4 text-faint transition-colors group-hover:text-accent"
          aria-hidden
        />
      </div>
      <h3 className="mt-3 line-clamp-2 font-display text-heading text-fg">{opportunity.title}</h3>
      {opportunity.summary && (
        <p className="mt-1 line-clamp-2 text-caption text-muted">{opportunity.summary}</p>
      )}
      <div className="mt-4 flex items-center gap-3 text-caption text-faint">
        {opportunity.latestVersionNumber > 0 && (
          <span className="inline-flex items-center gap-1">
            <Layers className="size-3.5" aria-hidden />v{opportunity.latestVersionNumber}
          </span>
        )}
        <span>Edited {formatRelative(opportunity.updatedAt)}</span>
      </div>
    </Link>
  );
}

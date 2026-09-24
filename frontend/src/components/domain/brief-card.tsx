import { CalendarClock, Globe2, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge, Tag } from "@/components/ui/display";
import type { Brief } from "@/lib/api/briefs";
import { formatDate, formatMoney } from "@/lib/utils/format";

function budget(brief: Brief): string | null {
  const { budgetMin: min, budgetMax: max, currency } = brief;
  if (min !== null && max !== null) {
    return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  }
  if (min !== null) {
    return `From ${formatMoney(min, currency)}`;
  }
  if (max !== null) {
    return `Up to ${formatMoney(max, currency)}`;
  }
  return null;
}

/** Open brief card (Explore "Open Briefs" tab, reference 28). */
export function BriefCard({ brief }: { brief: Brief }) {
  const range = budget(brief);
  return (
    <Link
      href={`/briefs/${brief.id}`}
      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2/60"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-body font-bold text-fg">{brief.title}</h3>
        <Badge tone={brief.status === "OPEN" ? "accent" : "neutral"}>{brief.status}</Badge>
      </div>
      <p className="mt-1.5 line-clamp-2 text-caption text-muted">{brief.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-fg-2">
        {range && <span className="tabular font-semibold text-accent">{range}</span>}
        <span className="inline-flex items-center gap-1">
          {brief.isRemote ? (
            <>
              <Globe2 className="size-3.5" aria-hidden /> Remote
            </>
          ) : (
            <>
              <MapPin className="size-3.5" aria-hidden /> {brief.location ?? "On site"}
            </>
          )}
        </span>
        {brief.applicationDeadline && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" aria-hidden /> Apply by{" "}
            {formatDate(brief.applicationDeadline)}
          </span>
        )}
      </div>
      {brief.deliverables.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Deliverables">
          {brief.deliverables.slice(0, 4).map((item) => (
            <li key={item}>
              <Tag>{item}</Tag>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}

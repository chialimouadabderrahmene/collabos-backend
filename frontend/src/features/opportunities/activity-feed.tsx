"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  ImageMinus,
  ImagePlus,
  Link2,
  Link2Off,
  PenLine,
  Sparkles,
  Upload,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/display";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/feedback";
import { opportunitiesApi, type Activity, type ActivityType } from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";
import { formatRelative } from "@/lib/utils/format";

const LABELS: Record<ActivityType, { icon: LucideIcon; text: (activity: Activity) => string }> = {
  CREATED: { icon: Sparkles, text: () => "Opportunity created" },
  UPDATED: {
    icon: PenLine,
    text: (activity) =>
      activity.metadata?.action === "restored"
        ? "Opportunity restored"
        : `Updated ${Array.isArray(activity.metadata?.fields) ? (activity.metadata.fields as string[]).join(", ") : "details"}`,
  },
  ARCHIVED: { icon: Archive, text: () => "Opportunity archived" },
  ASSET_UPLOADED: { icon: ImagePlus, text: (activity) => `Uploaded ${String(activity.metadata?.kind ?? "asset").toLowerCase()}` },
  ASSET_DELETED: { icon: ImageMinus, text: () => "Deleted an asset" },
  PUBLISHED: { icon: Upload, text: (activity) => `Published version ${String(activity.metadata?.versionNumber ?? "")}` },
  SHARE_LINK_CREATED: { icon: Link2, text: (activity) => `Created a share link for v${String(activity.metadata?.versionNumber ?? "")}` },
  SHARE_LINK_REVOKED: { icon: Link2Off, text: () => "Revoked a share link" },
  MEMBER_ADDED: { icon: UserPlus, text: (activity) => `Added a collaborator (${String(activity.metadata?.role ?? "").toLowerCase()})` },
  MEMBER_REMOVED: { icon: UserMinus, text: () => "Removed a collaborator" },
  AI_SUGGESTION_REQUESTED: { icon: Sparkles, text: (activity) => `Requested AI ${String(activity.metadata?.kind ?? "").toLowerCase().replace(/_/g, " ")}` },
};

export function ActivityFeed({ opportunityId }: { opportunityId: string }) {
  const activity = useQuery({
    queryKey: queryKeys.opportunities.activity(opportunityId),
    queryFn: () => opportunitiesApi.activity(opportunityId),
  });

  if (activity.isLoading) {
    return <SkeletonList count={3} />;
  }
  if (activity.isError) {
    return <ErrorState title="Couldn't load activity" onRetry={() => activity.refetch()} />;
  }
  const items = activity.data?.data ?? [];
  if (items.length === 0) {
    return <EmptyState title="No activity yet" />;
  }
  return (
    <Card>
      <ol className="divide-y divide-border">
        {items.map((item) => {
          const label = LABELS[item.type];
          const Icon = label.icon;
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-accent">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-body text-fg-2">{label.text(item)}</span>
              <time dateTime={item.createdAt} className="shrink-0 text-caption text-faint">
                {formatRelative(item.createdAt)}
              </time>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

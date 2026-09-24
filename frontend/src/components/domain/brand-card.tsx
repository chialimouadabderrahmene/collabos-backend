"use client";

import { BadgeCheck, MapPin } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Tag } from "@/components/ui/display";
import type { Brand } from "@/lib/api/brands";
import { formatCompact } from "@/lib/utils/format";

/** Explore brand card (reference 03): monogram, name + VERIFIED, location,
 * category tags, and Message / View Profile actions. */
export function BrandCard({
  brand,
  onMessage,
  messaging = false,
}: {
  brand: Brand;
  onMessage?: (brand: Brand) => void;
  messaging?: boolean;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <Avatar name={brand.name} src={brand.logoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-body font-bold text-fg">
              <Link href={`/explore/brands/${brand.id}`} className="hover:text-accent">
                {brand.name}
              </Link>
            </h3>
            {brand.isVerified && (
              <Badge tone="info">
                <BadgeCheck className="size-3" aria-hidden /> Verified
              </Badge>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 truncate text-caption text-muted">
            {brand.profile?.location && (
              <>
                <MapPin className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{brand.profile.location}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{formatCompact(brand.followersCount)} followers</span>
          </p>
        </div>
      </div>

      {brand.profile?.description && (
        <p className="mt-3 line-clamp-2 text-caption text-fg-2">{brand.profile.description}</p>
      )}

      {brand.categories.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Categories">
          {brand.categories.slice(0, 4).map((category) => (
            <li key={category.id}>
              <Tag>{category.name}</Tag>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="md"
          loading={messaging}
          onClick={() => onMessage?.(brand)}
          disabled={!onMessage}
        >
          Message
        </Button>
        <Button asChild size="md">
          <Link href={`/explore/brands/${brand.id}`}>View Profile</Link>
        </Button>
      </div>
    </article>
  );
}

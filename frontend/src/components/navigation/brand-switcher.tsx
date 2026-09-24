"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/overlays";
import { Avatar } from "@/components/ui/display";
import { Skeleton } from "@/components/ui/feedback";
import { useActiveBrand } from "@/features/brands/workspace";
import { cn } from "@/lib/utils/cn";

const ROLE_LABEL = { OWNER: "Owner", ADMIN: "Admin", EDITOR: "Editor", VIEWER: "Viewer" } as const;

/** Active brand workspace + switcher (desktop rail and profile). */
export function BrandSwitcher({ className }: { className?: string }) {
  const { brand, brands, isLoading, setActiveBrandId } = useActiveBrand();

  if (isLoading) {
    return <Skeleton className={cn("h-14 w-full rounded-lg", className)} />;
  }

  if (!brand) {
    return (
      <Link
        href="/onboarding"
        className={cn(
          "flex items-center gap-3 rounded-lg border border-dashed border-accent-line bg-accent-tint/50 p-3 text-caption font-semibold text-accent hover:bg-accent-tint",
          className,
        )}
      >
        <Plus className="size-4" aria-hidden /> Set up your brand
      </Link>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger
        aria-label={`Switch brand: ${brand.name}, ${ROLE_LABEL[brand.role]}`}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-2.5 text-left transition-colors hover:border-border-strong data-[state=open]:border-accent-line",
          className,
        )}
      >
        <Avatar name={brand.name} src={brand.logoUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-fg">{brand.name}</span>
          <span className="block text-caption text-muted">{ROLE_LABEL[brand.role]}</span>
        </span>
        <ChevronsUpDown className="size-4 text-faint" aria-hidden />
      </DropdownTrigger>
      <DropdownContent align="start" className="w-64">
        {brands.map((item) => (
          <DropdownItem key={item.id} onSelect={() => setActiveBrandId(item.id)}>
            <Avatar name={item.name} src={item.logoUrl} size="xs" />
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {item.id === brand.id && <Check className="size-4 text-accent" aria-hidden />}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link href="/onboarding?new=1">
            <Plus className="size-4" aria-hidden /> New brand
          </Link>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

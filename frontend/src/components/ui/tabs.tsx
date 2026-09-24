"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

/**
 * Two tab styles from the references:
 * - `underline`: tracked uppercase labels with a lime underline (onboarding
 *   "BRAND IDENTITY / VISUALS / STRATEGY", deal detail tabs);
 * - `segmented`: pill segments in a dark track (Explore "Brands / Open Briefs",
 *   Deals "Active / Completed").
 */
export function TabsList({
  variant = "underline",
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  variant?: "underline" | "segmented";
}) {
  return (
    <TabsPrimitive.List
      data-variant={variant}
      className={cn(
        "group/tabs flex",
        variant === "underline" && "gap-5 border-b border-border",
        variant === "segmented" && "gap-1 rounded-md border border-border bg-surface p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { children: ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        // underline
        "group-data-[variant=underline]/tabs:-mb-px group-data-[variant=underline]/tabs:border-b-2 group-data-[variant=underline]/tabs:border-transparent group-data-[variant=underline]/tabs:pb-2.5 group-data-[variant=underline]/tabs:text-label group-data-[variant=underline]/tabs:text-muted group-data-[variant=underline]/tabs:uppercase group-data-[variant=underline]/tabs:hover:text-fg-2",
        "group-data-[variant=underline]/tabs:data-[state=active]:border-accent group-data-[variant=underline]/tabs:data-[state=active]:text-accent",
        // segmented
        "group-data-[variant=segmented]/tabs:h-8 group-data-[variant=segmented]/tabs:flex-1 group-data-[variant=segmented]/tabs:rounded-sm group-data-[variant=segmented]/tabs:px-3 group-data-[variant=segmented]/tabs:text-caption group-data-[variant=segmented]/tabs:font-semibold group-data-[variant=segmented]/tabs:text-muted group-data-[variant=segmented]/tabs:hover:text-fg",
        "group-data-[variant=segmented]/tabs:data-[state=active]:bg-accent group-data-[variant=segmented]/tabs:data-[state=active]:text-accent-ink",
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

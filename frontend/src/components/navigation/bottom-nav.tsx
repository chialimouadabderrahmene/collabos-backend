"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { isActive, PRIMARY_NAV } from "./nav-items";

/** Mobile/tablet tab bar: five destinations, lime active state; Create is a
 * raised lime tile as the product's main creation entry point. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          const isCreate = item.href === "/create";
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[0.625rem] font-semibold tracking-wide transition-colors",
                  active ? "text-accent" : "text-faint hover:text-fg-2",
                )}
              >
                {isCreate ? (
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md transition-colors",
                      active
                        ? "bg-accent text-accent-ink"
                        : "bg-accent-tint text-accent ring-1 ring-accent-line",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={2.4} aria-hidden />
                  </span>
                ) : (
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                )}
                <span className={cn(isCreate && "sr-only")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

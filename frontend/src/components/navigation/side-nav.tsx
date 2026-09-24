"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/display";
import { useLogout, useSession } from "@/features/auth/hooks";
import { cn } from "@/lib/utils/cn";
import { BrandSwitcher } from "./brand-switcher";
import { isActive, type NavItem, PRIMARY_NAV, WORKSPACE_NAV } from "./nav-items";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-md px-3 text-body font-medium transition-colors",
        active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface hover:text-fg-2",
      )}
    >
      {active && (
        <span aria-hidden className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-accent" />
      )}
      <Icon
        className={cn("size-4.5", active ? "text-accent" : "text-faint group-hover:text-muted")}
        strokeWidth={active ? 2.3 : 1.9}
        aria-hidden
      />
      {item.label}
    </Link>
  );
}

/** Desktop rail (≥ lg): wordmark, brand workspace, primary destinations and
 * a secondary "Workspace" group, account at the bottom. */
export function SideNav() {
  const pathname = usePathname();
  const session = useSession();
  const logout = useLogout();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-bg lg:flex">
      <div className="px-5 pt-6 pb-5">
        <Link href="/home" aria-label="CollabOS home">
          <Wordmark size="sm" />
        </Link>
      </div>

      <div className="px-3">
        <BrandSwitcher />
      </div>

      <nav aria-label="Primary" className="mt-5 flex flex-col gap-0.5 px-3">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <nav aria-label="Workspace" className="mt-6 flex flex-col gap-0.5 overflow-y-auto px-3">
        <p className="mb-1.5 px-3 text-label text-faint uppercase">Workspace</p>
        {WORKSPACE_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="mt-auto border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar name={session.data?.email ?? "?"} shape="circle" size="sm" />
          <span className="min-w-0 flex-1 truncate text-caption text-fg-2">
            {session.data?.email ?? "…"}
          </span>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-md p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

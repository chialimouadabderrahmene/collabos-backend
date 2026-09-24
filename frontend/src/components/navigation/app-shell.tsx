import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";

/** Authenticated application frame: desktop rail + content, mobile bottom
 * tab bar. Pages render their own PageContainer/PageHeader. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
      </a>
      <SideNav />
      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

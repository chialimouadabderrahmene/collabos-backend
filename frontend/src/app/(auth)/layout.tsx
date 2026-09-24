import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/logo";

/** Auth frame: the splash's radial lime glow behind a focused single column. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-18rem] left-1/2 size-[42rem] -translate-x-1/2 rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(200,255,0,0.14) 0%, rgba(200,255,0,0.05) 35%, transparent 65%)",
        }}
      />
      <header className="relative px-6 pt-8 text-center">
        <Link href="/" aria-label="CollabOS home">
          <Wordmark size="lg" />
        </Link>
        <p className="mt-2 text-caption text-muted">Fashion Collaboration Operating System</p>
      </header>
      <main className="relative mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pt-10 pb-10">
        {children}
      </main>
    </div>
  );
}

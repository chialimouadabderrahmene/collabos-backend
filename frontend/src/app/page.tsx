import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const PILLARS = ["Create Opportunities", "Build Deals", "Launch Drops"];

/** Lime viewfinder brackets framing the splash (reference 00). */
function CornerBrackets() {
  const corner = "pointer-events-none absolute size-7 border-accent/70";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-5 sm:inset-8">
      <span className={`${corner} top-0 left-0 border-t-2 border-l-2`} />
      <span className={`${corner} top-0 right-0 border-t-2 border-r-2`} />
      <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${corner} right-0 bottom-0 border-r-2 border-b-2`} />
    </div>
  );
}

/** Round lime mark inside a dashed ring, as on the splash reference. */
function SplashMark() {
  return (
    <span className="relative mb-7 flex size-20 items-center justify-center rounded-full border border-dashed border-accent/60">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent font-display text-heading font-bold text-accent-ink shadow-[0_0_40px_rgba(200,255,0,0.35)]">
        OS
      </span>
    </span>
  );
}

/** Splash (reference 00): brackets, glow discs, mark, wordmark, pillars, CTA.
 * The reference's marketing stats (brands/collabs/revenue) are intentionally
 * omitted: no API backs them and hardcoding would be fabricated data. */
export default function SplashPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <CornerBrackets />
      {/* Concentric filled lime discs (reference glow) as ONE gradient layer
          with hard stops — same look, a single cheap paint on mobile GPUs. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 46%, rgba(200,255,0,0.11) 0 7.5rem, rgba(200,255,0,0.075) 7.5rem 14rem, rgba(200,255,0,0.04) 14rem 22rem, transparent 22rem)",
        }}
      />

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pt-16 text-center">
        <SplashMark />
        <h1>
          <Wordmark size="xl" />
        </h1>
        <span aria-hidden className="mt-3 h-0.5 w-12 rounded-full bg-accent" />
        <p className="mt-4 text-body text-fg-2">Fashion Collaboration Operating System</p>

        <ul className="mt-10 flex flex-wrap justify-center gap-2" aria-label="What you can do">
          {PILLARS.map((pillar) => (
            <li
              key={pillar}
              className="rounded-full bg-surface-2/90 px-3 py-1.5 text-caption font-medium text-fg-2 backdrop-blur"
            >
              {pillar}
            </li>
          ))}
        </ul>
      </main>

      <footer className="safe-bottom relative mx-auto flex w-full max-w-md flex-col gap-4 px-6 pb-12">
        <Button asChild size="lg" fullWidth>
          <Link href="/register">Get Started</Link>
        </Button>
        <p className="text-center text-caption text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </footer>
    </div>
  );
}

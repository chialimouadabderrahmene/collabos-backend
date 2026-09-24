import { ArrowRight, FileText, Handshake, Rocket, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/navigation/page";
import { cn } from "@/lib/utils/cn";

const SECONDARY: Array<{ href: string; title: string; description: string; icon: LucideIcon }> = [
  {
    href: "/explore",
    title: "Propose Collaboration",
    description: "Pitch a brand directly with a proposal.",
    icon: Handshake,
  },
  {
    href: "/drops/new",
    title: "Build Drop",
    description: "Launch a product drop with your partner.",
    icon: Rocket,
  },
  {
    href: "/explore",
    title: "Open Briefs",
    description: "Browse briefs from brands looking for partners.",
    icon: FileText,
  },
];

/** Create hub (reference S03): Opportunity Studio first, other flows below. */
export function CreateHub() {
  return (
    <PageContainer>
      <PageHeader title="Create" subtitle="What would you like to start?" />

      <Link
        href="/opportunities/new"
        className="group relative mb-4 block overflow-hidden rounded-xl border border-accent-line bg-accent-tint p-6 transition-colors hover:border-accent/60"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(200,255,0,0.25), transparent 65%)" }}
        />
        <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-ink">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-title text-fg">Create Opportunity</h2>
        <p className="mt-2 max-w-md text-body text-fg-2">
          Turn images, sketches, references and ideas into a polished editorial publication —
          then share a private, version-pinned link.
        </p>
        <span className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-body font-bold text-accent-ink transition-colors group-hover:bg-accent-hover">
          Start creating <ArrowRight className="size-4" aria-hidden />
        </span>
      </Link>

      <ul className="grid gap-3 sm:grid-cols-3">
        {SECONDARY.map(({ href, title, description, icon: Icon }) => (
          <li key={title}>
            <Link
              href={href}
              className={cn(
                "flex h-full flex-col rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2/60",
              )}
            >
              <Icon className="size-5 text-accent" aria-hidden />
              <p className="mt-3 text-body font-semibold text-fg">{title}</p>
              <p className="mt-1 text-caption text-muted">{description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}

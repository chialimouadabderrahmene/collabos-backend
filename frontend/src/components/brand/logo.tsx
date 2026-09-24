import { cn } from "@/lib/utils/cn";

/** "COLLABOS" wordmark with the acid-lime "OS", as on the splash/onboarding. */
export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "text-base tracking-[0.14em]",
    md: "text-xl tracking-[0.16em]",
    lg: "text-3xl tracking-[0.18em]",
    xl: "text-[2.75rem] leading-none tracking-[0.14em]",
  } as const;
  return (
    <span
      className={cn("font-display font-bold text-fg uppercase select-none", sizes[size], className)}
      aria-label="CollabOS"
    >
      COLLAB<span className="text-accent">OS</span>
    </span>
  );
}

/** Square lime mark used in compact navigation. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md bg-accent font-display text-[0.8125rem] font-bold tracking-tight text-accent-ink",
        className,
      )}
    >
      OS
    </span>
  );
}

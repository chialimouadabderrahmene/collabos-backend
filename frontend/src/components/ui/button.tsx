import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** Render the child element (e.g. a Next.js Link) with button styling. */
  asChild?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  // Acid-lime CTA with near-black ink — the signature CollabOS action.
  primary:
    "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-press disabled:bg-surface-3 disabled:text-faint",
  // Dark filled secondary ("Message", "Profile" buttons in the references).
  secondary:
    "bg-surface-2 text-fg border border-border hover:bg-surface-3 hover:border-border-strong disabled:text-faint",
  outline:
    "bg-transparent text-accent border border-accent-line hover:bg-accent-tint disabled:text-faint disabled:border-border",
  ghost: "bg-transparent text-fg-2 hover:bg-surface-2 hover:text-fg disabled:text-faint",
  danger:
    "bg-danger-tint text-danger border border-danger/30 hover:border-danger/60 disabled:text-faint",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-caption gap-1.5 rounded-md",
  md: "h-10 px-4 text-body gap-2 rounded-md",
  lg: "h-12 px-5 text-body gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      asChild = false,
      className,
      children,
      disabled,
      type,
      ...props
    },
    ref,
  ) {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed",
          VARIANTS[variant],
          SIZES[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Component>
    );
  },
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  variant?: "surface" | "ghost" | "accent";
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, variant = "surface", size = "md", className, type, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
          size === "md" ? "size-10" : "size-8",
          variant === "surface" &&
            "border border-border bg-surface text-fg-2 hover:border-border-strong hover:text-fg",
          variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
          variant === "accent" && "bg-accent text-accent-ink hover:bg-accent-hover",
          className,
        )}
        {...props}
      />
    );
  },
);

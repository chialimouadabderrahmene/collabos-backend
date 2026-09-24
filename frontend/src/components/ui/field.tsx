import { Check, ChevronDown, Search } from "lucide-react";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils/cn";

const CONTROL =
  "w-full rounded-md border border-border bg-surface px-3.5 text-body text-fg placeholder:text-faint transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger/70";

/** Uppercase, tracked micro-label used above every form control. */
export function FieldLabel({
  htmlFor,
  children,
  optional,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-2 flex items-center justify-between text-label uppercase text-muted",
        className,
      )}
    >
      <span>{children}</span>
      {optional && (
        <span className="text-label font-medium tracking-normal normal-case text-faint">
          Optional
        </span>
      )}
    </label>
  );
}

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Label + control + hint/error wiring with correct aria attributes. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const hasMessage = Boolean(error || hint);
  return (
    <div className={cn("flex flex-col", className)}>
      {label && (
        <FieldLabel htmlFor={id} optional={optional}>
          {label}
        </FieldLabel>
      )}
      {children({ id, describedBy: hasMessage ? messageId : undefined, invalid: Boolean(error) })}
      {hasMessage && (
        <p
          id={messageId}
          role={error ? "alert" : undefined}
          className={cn("mt-1.5 text-caption", error ? "text-danger" : "text-faint")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL, "h-11", className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(CONTROL, "min-h-24 resize-y py-3 leading-relaxed", className)}
      {...props}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(CONTROL, "h-11 cursor-pointer appearance-none pr-10", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted"
        />
      </div>
    );
  },
);

export const SearchInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function SearchInput({ className, ...props }, ref) {
  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
      />
      <input
        ref={ref}
        type="search"
        className={cn(CONTROL, "h-11 pl-10", className)}
        {...props}
      />
    </div>
  );
});

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, ChoiceProps>(function Checkbox(
  { label, description, className, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <label htmlFor={inputId} className={cn("group flex cursor-pointer items-start gap-3", className)}>
      <span className="relative mt-0.5 inline-flex size-4.5 shrink-0">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer size-4.5 cursor-pointer appearance-none rounded-sm border border-border-strong bg-surface transition-colors checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          {...props}
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0.5 size-3.5 text-accent-ink opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className="flex flex-col">
        <span className="text-body text-fg">{label}</span>
        {description && <span className="text-caption text-muted">{description}</span>}
      </span>
    </label>
  );
});

export const Radio = forwardRef<HTMLInputElement, ChoiceProps>(function Radio(
  { label, description, className, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input
        ref={ref}
        id={inputId}
        type="radio"
        className="mt-0.5 size-4.5 shrink-0 cursor-pointer appearance-none rounded-full border border-border-strong bg-surface transition-[border] checked:border-[5px] checked:border-accent disabled:cursor-not-allowed disabled:opacity-40"
        {...props}
      />
      <span className="flex flex-col">
        <span className="text-body text-fg">{label}</span>
        {description && <span className="text-caption text-muted">{description}</span>}
      </span>
    </label>
  );
});

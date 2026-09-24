"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, MailCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http";
import { passwordSchema } from "@/lib/validation/auth";

function Result({
  tone,
  title,
  body,
  action,
}: {
  tone: "success" | "error";
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="text-center" role={tone === "error" ? "alert" : "status"}>
      <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl border border-border bg-surface">
        {tone === "success" ? <CheckCircle2 className="size-6 text-accent" aria-hidden /> : <XCircle className="size-6 text-danger" aria-hidden />}
      </span>
      <h1 className="font-display text-title text-fg">{title}</h1>
      <p className="mt-2 text-body text-muted">{body}</p>
      <Button asChild className="mt-8" fullWidth>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    </div>
  );
}

/* --------------------------------------------------------- forgot */

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const valid = z.email().safeParse(email.trim()).success;
  const request = useMutation({ mutationFn: () => authApi.forgotPassword(email.trim()) });

  if (request.isSuccess) {
    return (
      <div className="text-center" role="status">
        <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl border border-border bg-surface">
          <MailCheck className="size-6 text-accent" aria-hidden />
        </span>
        <h1 className="font-display text-title text-fg">Check your inbox</h1>
        {/* Same message whether or not the account exists (no enumeration). */}
        <p className="mt-2 text-body text-muted">
          If an account exists for {email.trim()}, we&apos;ve sent a link to reset your password.
        </p>
        <Link href="/login" className="mt-8 inline-block text-body font-semibold text-accent">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-title text-fg">Reset your password</h1>
      <p className="mt-1.5 mb-8 text-body text-muted">We&apos;ll email you a secure link.</p>
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) request.mutate();
        }}
      >
        <Field label="Email" error={request.isError ? (request.error instanceof ApiError && request.error.isRateLimited ? "Too many requests. Try again in a minute." : "Something went wrong. Please try again.") : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="email" autoComplete="email" autoFocus aria-describedby={describedBy} aria-invalid={invalid || undefined} value={email} onChange={(event) => setEmail(event.target.value)} />
          )}
        </Field>
        <Button type="submit" size="lg" fullWidth disabled={!valid} loading={request.isPending}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-caption text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- reset */

const resetSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirmPassword: "" } });
  const reset = useMutation({ mutationFn: (values: ResetValues) => authApi.resetPassword(token, values.password) });
  const { errors } = form.formState;

  if (!token) {
    return (
      <Result tone="error" title="Invalid link" body="This reset link is incomplete. Request a new one." action={{ href: "/forgot-password", label: "Request a new link" }} />
    );
  }
  if (reset.isSuccess) {
    return <Result tone="success" title="Password updated" body="Sign in with your new password." action={{ href: "/login", label: "Sign in" }} />;
  }
  const failure =
    reset.error instanceof ApiError && (reset.error.status === 400 || reset.error.isUnauthorized || reset.error.isNotFound)
      ? "This link is invalid or has expired. Request a new one."
      : reset.isError
        ? "Couldn't reset your password. Please try again."
        : undefined;

  return (
    <div>
      <h1 className="font-display text-title text-fg">Choose a new password</h1>
      <p className="mt-1.5 mb-8 text-body text-muted">At least 8 characters with upper and lower case, a number and a symbol.</p>
      <form noValidate onSubmit={form.handleSubmit((values) => reset.mutate(values))} className="flex flex-col gap-5">
        <Field label="New password" error={errors.password?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("password")} />
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid || undefined} {...form.register("confirmPassword")} />
          )}
        </Field>
        {failure && (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-caption text-danger">
            {failure}{" "}
            <Link href="/forgot-password" className="font-semibold underline">
              New link
            </Link>
          </p>
        )}
        <Button type="submit" size="lg" fullWidth loading={reset.isPending}>
          Update password
        </Button>
      </form>
    </div>
  );
}

/* --------------------------------------------------------- verify */

export function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const verify = useMutation({ mutationFn: () => authApi.verifyEmail(token) });
  // Single-use token: submit exactly once, even under StrictMode double effects.
  const sent = useRef(false);
  useEffect(() => {
    if (token && !sent.current) {
      sent.current = true;
      verify.mutate();
    }
  }, [token, verify]);

  if (!token) {
    return <Result tone="error" title="Invalid link" body="This verification link is incomplete." action={{ href: "/home", label: "Go to CollabOS" }} />;
  }
  if (verify.isSuccess) {
    return <Result tone="success" title="Email verified" body="Thanks — your account is confirmed." action={{ href: "/home", label: "Continue" }} />;
  }
  if (verify.isError) {
    return (
      <Result tone="error" title="Link expired" body="This verification link is invalid or has already been used." action={{ href: "/home", label: "Go to CollabOS" }} />
    );
  }
  return <p className="text-center text-body text-muted" role="status">Verifying your email…</p>;
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/http";
import { registerSchema, type RegisterValues } from "@/lib/validation/auth";
import { useRegister } from "./hooks";

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    try {
      await register.mutateAsync({ email, password });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        form.setError("email", { message: "An account with this email already exists." });
        return;
      }
      // Known backend gap (docs/frontend-backend-gaps.md #5): registration can
      // return 500 after creating the account when email delivery fails. Try
      // signing in once with the same credentials before reporting failure.
      if (error instanceof ApiError && error.status >= 500) {
        try {
          await authApi.login({ email, password });
        } catch {
          form.setError("root", { message: error.message });
          return;
        }
      } else {
        form.setError("root", {
          message: error instanceof ApiError ? error.message : "Unable to create your account.",
        });
        return;
      }
    }
    router.replace("/onboarding");
    router.refresh();
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col">
      <h1 className="font-display text-title">Create your account</h1>
      <p className="mt-1.5 mb-8 text-body text-muted">
        Set up your studio in under two minutes.
      </p>

      <div className="flex flex-col gap-5">
        <Field label="Email" error={errors.email?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              placeholder="you@brand.com"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              {...form.register("email")}
            />
          )}
        </Field>
        <Field
          label="Password"
          hint="8+ characters with upper & lowercase, a number and a symbol."
          error={errors.password?.message}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              {...form.register("password")}
            />
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              {...form.register("confirmPassword")}
            />
          )}
        </Field>
      </div>

      {errors.root && (
        <p role="alert" className="mt-5 rounded-md border border-danger/25 bg-danger-tint px-3.5 py-2.5 text-caption text-danger">
          {errors.root.message}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-4 pt-10">
        <Button type="submit" size="lg" fullWidth loading={form.formState.isSubmitting}>
          Get Started
        </Button>
        <p className="text-center text-caption text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}

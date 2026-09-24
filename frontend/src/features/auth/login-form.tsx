"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError } from "@/lib/api/http";
import { loginSchema, safeNextPath, type LoginValues } from "@/lib/validation/auth";
import { useLogin } from "./hooks";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.replace(safeNextPath(params.get("next")));
      router.refresh();
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 401
          ? "Incorrect email or password."
          : error instanceof ApiError
            ? error.message
            : "Unable to sign in. Please try again.";
      form.setError("root", { message });
    }
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col">
      <h1 className="font-display text-title">Welcome back</h1>
      <p className="mt-1.5 mb-8 text-body text-muted">Sign in to your studio.</p>

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
        <Field label="Password" error={errors.password?.message}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              {...form.register("password")}
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
          Sign In
        </Button>
        <p className="text-center text-caption text-muted">
          New to CollabOS?{" "}
          <Link href="/register" className="font-semibold text-accent hover:text-accent-hover">
            Create an account
          </Link>
        </p>
      </div>
    </form>
  );
}

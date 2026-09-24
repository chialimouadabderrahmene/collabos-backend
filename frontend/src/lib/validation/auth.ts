import { z } from "zod";

/** Mirrors the backend RegisterDto so users see errors before submitting;
 * the backend still validates authoritatively. */
export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "At most 72 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number")
  .regex(/[^\da-zA-Z]/, "Add a symbol");

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "At least 8 characters"),
});

export const registerSchema = z
  .object({
    email: z.email("Enter a valid email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

/** Only allow same-origin relative redirects after sign-in. */
export function safeNextPath(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

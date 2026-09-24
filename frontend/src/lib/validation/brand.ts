import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Mirrors backend CreateBrandDto + UpdateBrandProfileDto constraints. */
export const brandIdentitySchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80, "At most 80 characters"),
  categoryId: z.string().optional(),
  country: optionalText(120),
  instagramHandle: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^@?[a-zA-Z0-9_.]{1,30}$/.test(value), {
      message: "Enter a valid Instagram username",
    })
    .transform((value) => (value ? value.replace(/^@/, "") : undefined)),
  websiteUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }
      return /^https?:\/\//i.test(value) ? value : `https://${value}`;
    })
    .refine((value) => !value || z.url().safeParse(value).success, {
      message: "Enter a valid website URL",
    }),
});

export const brandStrategySchema = z.object({
  description: optionalText(1000),
  foundedYear: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        !value ||
        (/^\d{4}$/.test(value) &&
          Number(value) >= 1800 &&
          Number(value) <= new Date().getFullYear()),
      { message: "Enter a year between 1800 and this year" },
    ),
  contactEmail: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || z.email().safeParse(value).success, {
      message: "Enter a valid email address",
    }),
});

export type BrandIdentityInput = z.input<typeof brandIdentitySchema>;
export type BrandIdentityValues = z.output<typeof brandIdentitySchema>;
export type BrandStrategyInput = z.input<typeof brandStrategySchema>;

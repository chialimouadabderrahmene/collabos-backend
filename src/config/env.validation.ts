import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  CORS_ORIGIN: z.string().default('*'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  SWAGGER_ENABLED: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().positive().default(12),

  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('CollabOS <no-reply@collabos.io>'),

  AVATAR_UPLOAD_DIR: z.string().default('./uploads/avatars'),
  AVATAR_MAX_SIZE_MB: z.coerce.number().int().positive().default(5),

  BRAND_ASSET_UPLOAD_DIR: z.string().default('./uploads/brands'),
  BRAND_LOGO_MAX_SIZE_MB: z.coerce.number().int().positive().default(5),
  BRAND_COVER_MAX_SIZE_MB: z.coerce.number().int().positive().default(8),

  MESSAGE_ATTACHMENT_UPLOAD_DIR: z.string().default('./uploads/messages'),
  MESSAGE_ATTACHMENT_MAX_SIZE_MB: z.coerce
    .number()
    .int()
    .positive()
    .default(10),

  CONTRACT_PDF_UPLOAD_DIR: z.string().default('./uploads/contracts'),

  DROP_MEDIA_UPLOAD_DIR: z.string().default('./uploads/drops'),
  DROP_MEDIA_MAX_SIZE_MB: z.coerce.number().int().positive().default(20),

  PRODUCT_MEDIA_UPLOAD_DIR: z.string().default('./uploads/products'),
  PRODUCT_MEDIA_MAX_SIZE_MB: z.coerce.number().int().positive().default(10),

  ORDERS_WEBHOOK_SECRET: z.string().min(16),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_CONNECT_REFRESH_URL: z.string().url(),
  STRIPE_CONNECT_RETURN_URL: z.string().url(),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  INVOICE_PDF_UPLOAD_DIR: z.string().default('./uploads/invoices'),

  STRIPE_PAYOUTS_WEBHOOK_SECRET: z.string().min(1),
  PAYOUT_MINIMUM_AMOUNT: z.coerce.number().int().positive().default(20),

  PUSH_PROVIDER_WEBHOOK_URL: z.string().url().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  AI_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  SENTRY_DSN: z.string().url().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  TYPESENSE_HOST: z.string().optional(),
  TYPESENSE_PORT: z.coerce.number().int().positive().default(443),
  TYPESENSE_PROTOCOL: z.enum(['http', 'https']).default('https'),
  TYPESENSE_API_KEY: z.string().optional(),
  SEARCH_REINDEX_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(300000),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads/storage'),
  STORAGE_LOCAL_PUBLIC_BASE_URL: z
    .string()
    .default('http://localhost:3000/storage'),
  STORAGE_SIGNING_SECRET: z.string().optional(),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().default('auto'),
  STORAGE_S3_ENDPOINT: z.string().url().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_S3_PUBLIC_BASE_URL: z.string().url().optional(),

  OTEL_SERVICE_NAME: z.string().default('collabos-backend'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${message}`);
  }

  return parsed.data;
}

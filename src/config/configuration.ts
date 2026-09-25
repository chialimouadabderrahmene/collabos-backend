import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  swaggerEnabled: (process.env.SWAGGER_ENABLED ?? 'true') === 'true',
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));

export const securityConfig = registerAs('security', () => ({
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
}));

export const mailConfig = registerAs('mail', () => ({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? '587', 10),
  secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
  user: process.env.SMTP_USER || undefined,
  password: process.env.SMTP_PASSWORD || undefined,
  from: process.env.SMTP_FROM ?? 'CollabOS <no-reply@collabos.io>',
}));

export const avatarConfig = registerAs('avatar', () => ({
  uploadDir: process.env.AVATAR_UPLOAD_DIR ?? './uploads/avatars',
  maxSizeMb: parseInt(process.env.AVATAR_MAX_SIZE_MB ?? '5', 10),
}));

export const brandAssetConfig = registerAs('brandAsset', () => ({
  uploadDir: process.env.BRAND_ASSET_UPLOAD_DIR ?? './uploads/brands',
  logoMaxSizeMb: parseInt(process.env.BRAND_LOGO_MAX_SIZE_MB ?? '5', 10),
  coverMaxSizeMb: parseInt(process.env.BRAND_COVER_MAX_SIZE_MB ?? '8', 10),
}));

export const messageAttachmentConfig = registerAs('messageAttachment', () => ({
  uploadDir: process.env.MESSAGE_ATTACHMENT_UPLOAD_DIR ?? './uploads/messages',
  maxSizeMb: parseInt(process.env.MESSAGE_ATTACHMENT_MAX_SIZE_MB ?? '10', 10),
}));

export const contractConfig = registerAs('contract', () => ({
  pdfUploadDir: process.env.CONTRACT_PDF_UPLOAD_DIR ?? './uploads/contracts',
}));

export const dropMediaConfig = registerAs('dropMedia', () => ({
  uploadDir: process.env.DROP_MEDIA_UPLOAD_DIR ?? './uploads/drops',
  maxSizeMb: parseInt(process.env.DROP_MEDIA_MAX_SIZE_MB ?? '20', 10),
}));

export const productMediaConfig = registerAs('productMedia', () => ({
  uploadDir: process.env.PRODUCT_MEDIA_UPLOAD_DIR ?? './uploads/products',
  maxSizeMb: parseInt(process.env.PRODUCT_MEDIA_MAX_SIZE_MB ?? '10', 10),
}));

export const ordersConfig = registerAs('orders', () => ({
  webhookSecret: process.env.ORDERS_WEBHOOK_SECRET,
}));

export const stripeConfig = registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  connectRefreshUrl: process.env.STRIPE_CONNECT_REFRESH_URL,
  connectReturnUrl: process.env.STRIPE_CONNECT_RETURN_URL,
  platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT ?? '10'),
}));

export const invoiceConfig = registerAs('invoice', () => ({
  pdfUploadDir: process.env.INVOICE_PDF_UPLOAD_DIR ?? './uploads/invoices',
}));

export const payoutsConfig = registerAs('payouts', () => ({
  webhookSecret: process.env.STRIPE_PAYOUTS_WEBHOOK_SECRET,
  minimumAmount: parseInt(process.env.PAYOUT_MINIMUM_AMOUNT ?? '20', 10),
}));

export const pushConfig = registerAs('push', () => ({
  providerWebhookUrl: process.env.PUSH_PROVIDER_WEBHOOK_URL || undefined,
}));

export const aiConfig = registerAs('ai', () => ({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
  cacheTtlSeconds: parseInt(process.env.AI_CACHE_TTL_SECONDS ?? '900', 10),
}));

export const throttleConfig = registerAs('throttle', () => ({
  ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
}));

export const sentryConfig = registerAs('sentry', () => ({
  dsn: process.env.SENTRY_DSN || undefined,
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
}));

export const typesenseConfig = registerAs('typesense', () => ({
  host: process.env.TYPESENSE_HOST || undefined,
  port: parseInt(process.env.TYPESENSE_PORT ?? '443', 10),
  protocol: process.env.TYPESENSE_PROTOCOL ?? 'https',
  apiKey: process.env.TYPESENSE_API_KEY || undefined,
  reindexIntervalMs: parseInt(
    process.env.SEARCH_REINDEX_INTERVAL_MS ?? '300000',
    10,
  ),
}));

export const otelConfig = registerAs('otel', () => ({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'collabos-backend',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || undefined,
}));

export const storageConfig = registerAs('storage', () => ({
  provider: process.env.STORAGE_PROVIDER ?? 'local',
  localDir: process.env.STORAGE_LOCAL_DIR ?? './uploads/storage',
  localPublicBaseUrl:
    process.env.STORAGE_LOCAL_PUBLIC_BASE_URL ??
    'http://localhost:3000/storage',
  signingSecret: process.env.STORAGE_SIGNING_SECRET,
  s3Bucket: process.env.STORAGE_S3_BUCKET,
  s3Region: process.env.STORAGE_S3_REGION ?? 'auto',
  s3Endpoint: process.env.STORAGE_S3_ENDPOINT || undefined,
  s3AccessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
  s3PublicBaseUrl: process.env.STORAGE_S3_PUBLIC_BASE_URL || undefined,
}));

export const opportunitiesConfig = registerAs('opportunities', () => ({
  assetMaxSizeMb: parseInt(
    process.env.OPPORTUNITY_ASSET_MAX_SIZE_MB ?? '15',
    10,
  ),
  assetUrlTtlSeconds: parseInt(
    process.env.OPPORTUNITY_ASSET_URL_TTL_SECONDS ?? '900',
    10,
  ),
  shareBaseUrl:
    process.env.OPPORTUNITY_SHARE_BASE_URL ||
    `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/share`,
  aiMaxTokens: parseInt(process.env.OPPORTUNITY_AI_MAX_TOKENS ?? '2048', 10),
}));

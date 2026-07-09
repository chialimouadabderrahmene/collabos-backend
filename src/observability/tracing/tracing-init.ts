import { createTracingSdk } from './tracing';

/** Side-effect module: must be the very first import in main.ts, before
 * @nestjs/core or any instrumented module (http, express, pg, ioredis, ...)
 * is required, otherwise the auto-instrumentations can't patch them. */
const sdk = createTracingSdk({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'collabos-backend',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || undefined,
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().catch(() => undefined);
});

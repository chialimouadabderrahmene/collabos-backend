import * as Sentry from '@sentry/node';

export function initSentry(params: {
  dsn: string | undefined;
  environment: string;
  tracesSampleRate: number;
}): void {
  if (!params.dsn) {
    return;
  }

  Sentry.init({
    dsn: params.dsn,
    environment: params.environment,
    tracesSampleRate: params.tracesSampleRate,
  });
}

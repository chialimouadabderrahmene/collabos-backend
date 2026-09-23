import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ConsoleSpanExporter,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { IncomingMessage } from 'node:http';
import { redactUrl } from '../../common/logging/redact-url';

export interface TracingConfig {
  serviceName: string;
  otlpEndpoint?: string;
}

/** Console exporter when no collector is configured — real spans are still
 * produced and printed, not a stub. Switches to OTLP/HTTP once
 * OTEL_EXPORTER_OTLP_ENDPOINT is set. */
export function buildTraceExporter(otlpEndpoint?: string): SpanExporter {
  return otlpEndpoint
    ? new OTLPTraceExporter({ url: otlpEndpoint })
    : new ConsoleSpanExporter();
}

export function createTracingSdk(config: TracingConfig): NodeSDK {
  return new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
    }),
    traceExporter: buildTraceExporter(config.otlpEndpoint),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          // Incoming URLs can carry bearer secrets (share tokens, signed-URL
          // signatures); overwrite the URL attributes with redacted values.
          requestHook: (span, request) => {
            if (request instanceof IncomingMessage && request.url) {
              const redacted = redactUrl(request.url);
              span.setAttribute('http.target', redacted);
              span.setAttribute('url.path', redacted.split('?')[0]);
              span.setAttribute('url.full', redacted);
              span.setAttribute('http.url', redacted);
            }
          },
        },
      }),
    ],
  });
}

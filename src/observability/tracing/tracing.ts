import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ConsoleSpanExporter,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

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
    instrumentations: [getNodeAutoInstrumentations()],
  });
}

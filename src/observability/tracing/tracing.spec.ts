import { describe, expect, it, vi } from 'vitest';

const { OTLPTraceExporterMock, ConsoleSpanExporterMock, NodeSDKMock } =
  vi.hoisted(() => ({
    OTLPTraceExporterMock: vi.fn().mockImplementation((opts: unknown) => ({
      type: 'otlp',
      opts,
    })),
    ConsoleSpanExporterMock: vi.fn().mockImplementation(() => ({
      type: 'console',
    })),
    NodeSDKMock: vi.fn().mockImplementation((config: unknown) => ({ config })),
  }));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: OTLPTraceExporterMock,
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  ConsoleSpanExporter: ConsoleSpanExporterMock,
}));

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: NodeSDKMock,
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn().mockReturnValue(['instrumentation']),
}));

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: vi.fn((attrs: unknown) => ({ attrs })),
}));

import { buildTraceExporter, createTracingSdk } from './tracing';

describe('buildTraceExporter', () => {
  it('returns a console exporter when no OTLP endpoint is configured', () => {
    const exporter = buildTraceExporter(undefined) as unknown as {
      type: string;
    };

    expect(exporter.type).toBe('console');
    expect(OTLPTraceExporterMock).not.toHaveBeenCalled();
  });

  it('returns an OTLP exporter pointed at the configured endpoint', () => {
    const exporter = buildTraceExporter(
      'http://collector:4318/v1/traces',
    ) as unknown as { type: string };

    expect(exporter.type).toBe('otlp');
    expect(OTLPTraceExporterMock).toHaveBeenCalledWith({
      url: 'http://collector:4318/v1/traces',
    });
  });
});

describe('createTracingSdk', () => {
  it('builds a NodeSDK with auto-instrumentations and the resolved exporter', () => {
    createTracingSdk({ serviceName: 'collabos-backend' });

    expect(NodeSDKMock).toHaveBeenCalledTimes(1);
    const call = NodeSDKMock.mock.calls[0][0] as {
      traceExporter: { type: string };
      instrumentations: unknown[];
    };
    expect(call.traceExporter.type).toBe('console');
    expect(call.instrumentations).toEqual([['instrumentation']]);
  });
});

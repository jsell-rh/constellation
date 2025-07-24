/**
 * OpenTelemetry Distributed Tracing Configuration
 * Provides automatic distributed tracing with proper instrumentation
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import * as api from '@opentelemetry/api';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

// Global SDK instance
let sdk: NodeSDK | null = null;

/**
 * Configuration options for tracing
 */
export interface TracingConfig {
  serviceName?: string;
  serviceVersion?: string;
  enabled?: boolean;
  exporterUrl?: string;
  debug?: boolean;
}

/**
 * Initialize OpenTelemetry distributed tracing
 */
export function initializeTracing(config: TracingConfig = {}): void {
  const {
    serviceName = 'constellation',
    serviceVersion = process.env.npm_package_version || '1.0.0',
    enabled = process.env.TRACE_ENABLED === 'true' || false,
    exporterUrl = process.env.TRACE_ENDPOINT || 'http://localhost:14268/api/traces',
    debug = process.env.NODE_ENV === 'development',
  } = config;

  if (!enabled) {
    logger.info('Distributed tracing disabled');
    return;
  }

  try {
    // Set environment variables for service information
    process.env.OTEL_SERVICE_NAME = serviceName;
    process.env.OTEL_SERVICE_VERSION = serviceVersion;
    if (exporterUrl) {
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = exporterUrl;
    }

    // Initialize SDK with auto-instrumentations
    sdk = new NodeSDK({
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable some noisy instrumentations
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-redis': { enabled: true },
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    logger.info(
      {
        serviceName,
        serviceVersion,
        exporterUrl,
        debug,
      },
      'OpenTelemetry distributed tracing initialized',
    );

    // Add process exit handler
    process.on('SIGTERM', () => {
      sdk
        ?.shutdown()
        .then(() => logger.info('Tracing SDK shut down successfully'))
        .catch((error) => logger.error({ error }, 'Error shutting down tracing SDK'));
    });
  } catch (error) {
    logger.error({ error }, 'Failed to initialize OpenTelemetry tracing');
    throw error;
  }
}

/**
 * Shutdown tracing (for testing)
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    logger.info('Tracing SDK shut down');
  }
}

/**
 * Get the global tracer instance
 */
export function getTracer(name: string = 'constellation'): api.Tracer {
  return api.trace.getTracer(name, process.env.npm_package_version);
}

/**
 * Create a new span with automatic error handling
 */
export function createSpan(name: string, options?: api.SpanOptions): api.Span {
  const tracer = getTracer();
  return tracer.startSpan(name, options);
}

/**
 * Execute a function within a span with automatic error handling
 */
export async function withSpan<T>(
  name: string,
  fn: (span: api.Span) => Promise<T>,
  options?: api.SpanOptions,
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(name, options || {}, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof Error) {
        span.recordException(error);
      }

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Execute a synchronous function within a span
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: api.Span) => T,
  options?: api.SpanOptions,
): T {
  const tracer = getTracer();

  return tracer.startActiveSpan(name, options || {}, (span) => {
    try {
      const result = fn(span);
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof Error) {
        span.recordException(error);
      }

      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Add attributes to the current active span
 */
export function addSpanAttributes(attributes: api.Attributes): void {
  const activeSpan = api.trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.setAttributes(attributes);
  }
}

/**
 * Add an event to the current active span
 */
export function addSpanEvent(name: string, attributes?: api.Attributes): void {
  const activeSpan = api.trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.addEvent(name, attributes);
  }
}

/**
 * Get current trace ID from active span
 */
export function getCurrentTraceId(): string | undefined {
  const activeSpan = api.trace.getActiveSpan();
  if (activeSpan) {
    const spanContext = activeSpan.spanContext();
    return spanContext.traceId;
  }
  return undefined;
}

/**
 * Get current span ID from active span
 */
export function getCurrentSpanId(): string | undefined {
  const activeSpan = api.trace.getActiveSpan();
  if (activeSpan) {
    const spanContext = activeSpan.spanContext();
    return spanContext.spanId;
  }
  return undefined;
}

/**
 * Create a child span from the current active span
 */
export function createChildSpan(name: string, options?: api.SpanOptions): api.Span {
  const tracer = getTracer();
  const activeContext = api.context.active();

  return tracer.startSpan(
    name,
    {
      ...options,
    },
    activeContext,
  );
}

/**
 * Inject trace context into carriers (for distributed tracing)
 */
export function injectTraceContext(carrier: Record<string, unknown>): void {
  api.propagation.inject(api.context.active(), carrier);
}

/**
 * Extract trace context from carriers (for distributed tracing)
 */
export function extractTraceContext(carrier: Record<string, unknown>): api.Context {
  return api.propagation.extract(api.context.active(), carrier);
}

/**
 * Run a function with extracted trace context
 */
export async function withExtractedContext<T>(
  carrier: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const extractedContext = extractTraceContext(carrier);
  return api.context.with(extractedContext, fn);
}

/**
 * Common span attributes for Constellation operations
 */
export const SpanAttributes = {
  // Librarian attributes
  LIBRARIAN_ID: 'constellation.librarian.id',
  LIBRARIAN_NAME: 'constellation.librarian.name',
  LIBRARIAN_VERSION: 'constellation.librarian.version',

  // Query attributes
  QUERY_TEXT: 'constellation.query.text',
  QUERY_USER_ID: 'constellation.query.user_id',
  QUERY_INTENT: 'constellation.query.intent',

  // Delegation attributes
  DELEGATION_TYPE: 'constellation.delegation.type',
  DELEGATION_TARGET: 'constellation.delegation.target',
  DELEGATION_CHAIN_DEPTH: 'constellation.delegation.chain_depth',

  // Response attributes
  RESPONSE_CONFIDENCE: 'constellation.response.confidence',
  RESPONSE_SOURCE_COUNT: 'constellation.response.source_count',

  // AI attributes
  AI_PROVIDER: 'constellation.ai.provider',
  AI_MODEL: 'constellation.ai.model',
  AI_PROMPT_TOKENS: 'constellation.ai.prompt_tokens',
  AI_COMPLETION_TOKENS: 'constellation.ai.completion_tokens',

  // Cache attributes
  CACHE_HIT: 'constellation.cache.hit',
  CACHE_KEY: 'constellation.cache.key',
  CACHE_TTL: 'constellation.cache.ttl',
} as const;

/**
 * Semantic span names for consistent tracing
 */
export const SpanNames = {
  // Core operations
  LIBRARIAN_EXECUTION: 'librarian.execute',
  QUERY_ROUTING: 'query.route',
  RESPONSE_AGGREGATION: 'response.aggregate',

  // AI operations
  AI_COMPLETION: 'ai.completion',
  AI_ANALYSIS: 'ai.analysis',
  AI_DELEGATION: 'ai.delegation',

  // Cache operations
  CACHE_GET: 'cache.get',
  CACHE_SET: 'cache.set',
  CACHE_DELETE: 'cache.delete',

  // Registry operations
  REGISTRY_LOAD: 'registry.load',
  REGISTRY_RESOLVE: 'registry.resolve',

  // HTTP operations
  HTTP_REQUEST: 'http.request',
  HTTP_RESPONSE: 'http.response',
} as const;

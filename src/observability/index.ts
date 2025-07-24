/**
 * Observability module exports
 * Provides tracing, metrics, and logging for Constellation
 */

// Main tracing implementation
export * from './tracing';

// Re-export commonly used OpenTelemetry types
export {
  SpanStatusCode,
  SpanKind,
  type Span,
  type SpanOptions,
  type Context as OTelContext,
  type Attributes,
} from '@opentelemetry/api';

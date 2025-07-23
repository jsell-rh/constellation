/**
 * Observability module exports
 * Provides tracing, metrics, and logging for Constellation
 */

// Use simplified tracing to avoid version conflicts
export * from './simple-tracing';

// Re-export commonly used OpenTelemetry types
export { 
  SpanStatusCode,
  SpanKind,
  type Span,
  type SpanOptions,
  type Context as OTelContext,
  type Attributes,
} from '@opentelemetry/api';
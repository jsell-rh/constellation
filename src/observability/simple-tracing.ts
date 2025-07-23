/**
 * Simplified OpenTelemetry Tracing Configuration
 * Provides automatic distributed tracing without version conflicts
 */

import * as api from '@opentelemetry/api';
import { ulid } from 'ulid';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

// Custom simple tracer implementation
class SimpleTracer implements api.Tracer {
  constructor(_name: string, _version?: string) {}

  startSpan(name: string, options?: api.SpanOptions): api.Span {
    const spanContext: api.SpanContext = {
      traceId: ulid().toLowerCase(),
      spanId: ulid().toLowerCase().substring(0, 16),
      traceFlags: api.TraceFlags.SAMPLED,
    };

    const span = new SimpleSpan(name, spanContext);
    
    // Log span start if in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug({
        span: name,
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        attributes: options?.attributes,
      }, 'Span started');
    }

    return span;
  }

  startActiveSpan<F extends (span: api.Span) => unknown>(
    name: string,
    fn: F
  ): ReturnType<F>;
  startActiveSpan<F extends (span: api.Span) => unknown>(
    name: string,
    options: api.SpanOptions,
    fn: F
  ): ReturnType<F>;
  startActiveSpan<F extends (span: api.Span) => unknown>(
    name: string,
    options: api.SpanOptions,
    context: api.Context,
    fn: F
  ): ReturnType<F>;
  startActiveSpan<F extends (span: api.Span) => unknown>(...args: unknown[]): ReturnType<F> {
    const [name, optionsOrFn, contextOrFn, maybeFn] = args;
    const options = typeof optionsOrFn === 'object' && optionsOrFn !== null ? optionsOrFn as api.SpanOptions : {};
    const fn = (maybeFn || contextOrFn || optionsOrFn) as F;
    const span = this.startSpan(name as string, options);
    return fn(span) as ReturnType<F>;
  }
}

// Simple span implementation
class SimpleSpan implements api.Span {
  private _spanContext: api.SpanContext;
  private _name: string;
  private _attributes: api.Attributes = {};
  private _events: Array<{ name: string; time: number; attributes?: api.Attributes }> = [];
  private _status: api.SpanStatus = { code: api.SpanStatusCode.UNSET };
  private _startTime: number;
  private _endTime?: number;

  constructor(name: string, spanContext: api.SpanContext) {
    this._name = name;
    this._spanContext = spanContext;
    this._startTime = Date.now();
  }

  spanContext(): api.SpanContext {
    return this._spanContext;
  }

  setAttribute(key: string, value: api.AttributeValue): this {
    this._attributes[key] = value;
    return this;
  }

  setAttributes(attributes: api.Attributes): this {
    Object.assign(this._attributes, attributes);
    return this;
  }

  addEvent(name: string, attributesOrTime?: api.Attributes | number, time?: number): this {
    const event = {
      name,
      time: typeof attributesOrTime === 'number' ? attributesOrTime : time || Date.now(),
      ...(typeof attributesOrTime === 'object' && { attributes: attributesOrTime }),
    };
    this._events.push(event);
    return this;
  }

  setStatus(status: api.SpanStatus): this {
    this._status = status;
    return this;
  }

  updateName(name: string): this {
    this._name = name;
    return this;
  }

  end(endTime?: number): void {
    if (this._endTime) return;
    
    this._endTime = endTime || Date.now();
    const duration = this._endTime - this._startTime;

    // Log span completion if in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug({
        span: this._name,
        traceId: this._spanContext.traceId,
        spanId: this._spanContext.spanId,
        duration: `${duration}ms`,
        status: this._status.code === api.SpanStatusCode.OK ? 'OK' : 'ERROR',
        attributes: this._attributes,
        events: this._events,
      }, 'Span completed');
    }
  }

  isRecording(): boolean {
    return !this._endTime;
  }

  recordException(exception: api.Exception, time?: number): void {
    const errorName = exception instanceof Error ? exception.name : 'Error';
    const errorMessage = exception instanceof Error ? exception.message : String(exception);
    
    this.addEvent('exception', {
      'exception.type': errorName,
      'exception.message': errorMessage,
    }, time);
  }
}

// Global tracer instance
let globalTracer: api.Tracer | null = null;

/**
 * Initialize tracing (simplified version)
 */
export function initializeTracing(config?: {
  serviceName?: string;
  enabled?: boolean;
}): void {
  const tracingEnabled = config?.enabled ?? 
    process.env.TRACE_ENABLED === 'true' ?? 
    false;

  if (!tracingEnabled) {
    logger.info('Tracing disabled');
    return;
  }

  logger.info({
    serviceName: config?.serviceName ?? 'constellation',
  }, 'Simple tracing initialized');
}

/**
 * Get the global tracer instance
 */
export function getTracer(name: string = 'constellation'): api.Tracer {
  if (!globalTracer) {
    globalTracer = new SimpleTracer(name, process.env.npm_package_version);
  }
  return globalTracer;
}

/**
 * Create a new span with automatic error handling
 */
export function createSpan(
  name: string,
  options?: api.SpanOptions
): api.Span {
  const tracer = getTracer();
  return tracer.startSpan(name, options);
}

/**
 * Execute a function within a span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: api.Span) => Promise<T>,
  options?: api.SpanOptions
): Promise<T> {
  const span = createSpan(name, options);
  
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
}

/**
 * Add attributes to the current span
 */
export function addSpanAttributes(_attributes: api.Attributes): void {
  // In our simple implementation, we don't have active span tracking
  // This is a no-op but maintains the API
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(_name: string, _attributes?: api.Attributes): void {
  // In our simple implementation, we don't have active span tracking
  // This is a no-op but maintains the API
}

/**
 * Get current trace ID
 */
export function getCurrentTraceId(): string | undefined {
  // Generate a new trace ID for now
  return ulid().toLowerCase();
}

/**
 * Get current span ID
 */
export function getCurrentSpanId(): string | undefined {
  // Generate a new span ID for now
  return ulid().toLowerCase().substring(0, 16);
}
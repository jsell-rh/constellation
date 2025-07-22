/**
 * Observability Interfaces
 * 
 * Defines tracing, metrics, and logging for the system.
 */

/**
 * Distributed tracing
 */
export interface Tracer {
  /**
   * Start a new span
   */
  startSpan(
    operationName: string,
    parentContext?: TraceContext
  ): Span;
  
  /**
   * End a span
   */
  endSpan(spanId: string, status?: SpanStatus): void;
  
  /**
   * Add an event to a span
   */
  addEvent(spanId: string, name: string, attributes?: Record<string, any>): void;
  
  /**
   * Set span attributes
   */
  setAttribute(spanId: string, key: string, value: any): void;
  
  /**
   * Get current trace context
   */
  getCurrentContext(): TraceContext | null;
}

/**
 * Trace context passed between services
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags?: number;
  traceState?: string;
}

/**
 * Span representing a unit of work
 */
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, any>;
  events: SpanEvent[];
  status: SpanStatus;
  links?: SpanLink[];
}

/**
 * Span status
 */
export interface SpanStatus {
  code: 'OK' | 'ERROR' | 'CANCELLED';
  message?: string;
}

/**
 * Event within a span
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
}

/**
 * Link to another span
 */
export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes?: Record<string, any>;
}

/**
 * Metrics collector
 */
export interface MetricsCollector {
  /**
   * Increment a counter
   */
  incrementCounter(
    name: string,
    labels?: Record<string, string>,
    value?: number
  ): void;
  
  /**
   * Record a gauge value
   */
  recordGauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void;
  
  /**
   * Record a histogram value
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
    buckets?: number[]
  ): void;
  
  /**
   * Get current metrics
   */
  getMetrics(): MetricsSnapshot;
}

/**
 * Snapshot of current metrics
 */
export interface MetricsSnapshot {
  timestamp: number;
  counters: MetricValue[];
  gauges: MetricValue[];
  histograms: HistogramValue[];
}

/**
 * Single metric value
 */
export interface MetricValue {
  name: string;
  value: number;
  labels: Record<string, string>;
}

/**
 * Histogram metric value
 */
export interface HistogramValue {
  name: string;
  count: number;
  sum: number;
  buckets: HistogramBucket[];
  labels: Record<string, string>;
}

/**
 * Histogram bucket
 */
export interface HistogramBucket {
  upperBound: number;
  count: number;
}

/**
 * Structured logger
 */
export interface Logger {
  /**
   * Log at different levels
   */
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  
  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger;
}

/**
 * Log context
 */
export interface LogContext {
  traceId?: string;
  spanId?: string;
  librarian?: string;
  query?: string;
  user?: string;
  duration?: number;
  [key: string]: any;
}

/**
 * Health check interface
 */
export interface HealthChecker {
  /**
   * Check if service is healthy
   */
  check(): Promise<HealthStatus>;
  
  /**
   * Register a health check
   */
  register(name: string, check: () => Promise<boolean>): void;
}

/**
 * Health status
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: number;
  checks: HealthCheckResult[];
  version?: string;
  uptime?: number;
}

/**
 * Individual health check result
 */
export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Standard metrics names
 */
export const METRIC_NAMES = {
  // Request metrics
  REQUESTS_TOTAL: 'librarian_requests_total',
  REQUEST_DURATION: 'librarian_request_duration_seconds',
  REQUEST_SIZE: 'librarian_request_size_bytes',
  RESPONSE_SIZE: 'librarian_response_size_bytes',
  
  // Delegation metrics
  DELEGATIONS_TOTAL: 'librarian_delegations_total',
  DELEGATION_DEPTH: 'librarian_delegation_depth',
  DELEGATION_FAILURES: 'librarian_delegation_failures_total',
  
  // AI metrics
  AI_TOKENS_USED: 'librarian_ai_tokens_used_total',
  AI_REQUESTS: 'librarian_ai_requests_total',
  AI_LATENCY: 'librarian_ai_latency_seconds',
  
  // Cache metrics
  CACHE_HITS: 'librarian_cache_hits_total',
  CACHE_MISSES: 'librarian_cache_misses_total',
  CACHE_SIZE: 'librarian_cache_size_bytes',
  
  // Circuit breaker metrics
  CIRCUIT_BREAKER_STATE: 'librarian_circuit_breaker_state',
  CIRCUIT_BREAKER_TRIPS: 'librarian_circuit_breaker_trips_total',
  
  // Error metrics
  ERRORS_TOTAL: 'librarian_errors_total',
  TIMEOUTS_TOTAL: 'librarian_timeouts_total',
  
  // System metrics
  ACTIVE_CONNECTIONS: 'librarian_active_connections',
  MEMORY_USAGE: 'librarian_memory_usage_bytes',
  CPU_USAGE: 'librarian_cpu_usage_percent'
};
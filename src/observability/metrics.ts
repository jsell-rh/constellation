/**
 * Prometheus Metrics for Constellation
 * Provides comprehensive metrics for monitoring system performance and health
 */

import { register, collectDefaultMetrics, Counter, Histogram, Gauge, Summary } from 'prom-client';
import type { Response } from '../types/core';
import { createLogger } from './logger';

const logger = createLogger('metrics');

// Configure default metrics collection
collectDefaultMetrics({
  prefix: 'constellation_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

/**
 * Query metrics
 */
export const queryCounter = new Counter({
  name: 'constellation_queries_total',
  help: 'Total number of queries processed',
  labelNames: ['librarian', 'status', 'error_code'],
});

export const queryDuration = new Histogram({
  name: 'constellation_query_duration_seconds',
  help: 'Query processing duration in seconds',
  labelNames: ['librarian', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10], // Match SLA requirement of <2s
});

export const activeQueries = new Gauge({
  name: 'constellation_active_queries',
  help: 'Number of currently active queries',
  labelNames: ['librarian'],
});

/**
 * Librarian metrics
 */
export const librarianRegistrations = new Gauge({
  name: 'constellation_librarians_registered',
  help: 'Number of registered librarians',
  labelNames: ['team', 'capability'],
});

export const librarianExecutions = new Counter({
  name: 'constellation_librarian_executions_total',
  help: 'Total number of librarian executions',
  labelNames: ['librarian', 'team', 'status'],
});

export const librarianExecutionDuration = new Histogram({
  name: 'constellation_librarian_execution_duration_seconds',
  help: 'Librarian execution duration in seconds',
  labelNames: ['librarian', 'team'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

/**
 * AI metrics
 */
export const aiRequests = new Counter({
  name: 'constellation_ai_requests_total',
  help: 'Total number of AI API requests',
  labelNames: ['provider', 'model', 'operation', 'status'],
});

export const aiTokensUsed = new Counter({
  name: 'constellation_ai_tokens_total',
  help: 'Total number of AI tokens used',
  labelNames: ['provider', 'model', 'type'], // type: prompt, completion
});

export const aiRequestDuration = new Histogram({
  name: 'constellation_ai_request_duration_seconds',
  help: 'AI API request duration in seconds',
  labelNames: ['provider', 'model', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

/**
 * Delegation metrics
 */
export const delegationDecisions = new Counter({
  name: 'constellation_delegation_decisions_total',
  help: 'Total number of delegation decisions made',
  labelNames: ['engine', 'target_count', 'confidence_level'], // confidence_level: high/medium/low
});

export const delegationChainDepth = new Histogram({
  name: 'constellation_delegation_chain_depth',
  help: 'Depth of delegation chains',
  buckets: [1, 2, 3, 4, 5, 10],
});

export const parallelDelegations = new Counter({
  name: 'constellation_parallel_delegations_total',
  help: 'Total number of parallel delegation operations',
  labelNames: ['count'], // How many librarians queried in parallel
});

/**
 * Response metrics
 */
export const responseConfidence = new Summary({
  name: 'constellation_response_confidence',
  help: 'Response confidence scores',
  labelNames: ['librarian', 'aggregation_strategy'],
  percentiles: [0.5, 0.9, 0.99],
});

export const responseSourceCount = new Histogram({
  name: 'constellation_response_source_count',
  help: 'Number of sources in responses',
  labelNames: ['librarian'],
  buckets: [0, 1, 2, 5, 10, 20],
});

/**
 * Cache metrics
 */
export const cacheHits = new Counter({
  name: 'constellation_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['librarian', 'cache_type'],
});

export const cacheMisses = new Counter({
  name: 'constellation_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['librarian', 'cache_type'],
});

export const cacheOperationDuration = new Histogram({
  name: 'constellation_cache_operation_duration_seconds',
  help: 'Cache operation duration in seconds',
  labelNames: ['operation', 'cache_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
});

/**
 * Circuit breaker metrics
 */
export const circuitBreakerState = new Gauge({
  name: 'constellation_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['librarian'],
});

export const circuitBreakerTrips = new Counter({
  name: 'constellation_circuit_breaker_trips_total',
  help: 'Total number of circuit breaker trips',
  labelNames: ['librarian', 'reason'],
});

export const circuitBreakerRejections = new Counter({
  name: 'constellation_circuit_breaker_rejections_total',
  help: 'Total number of requests rejected by circuit breakers',
  labelNames: ['librarian', 'state'],
});

/**
 * Error metrics
 */
export const errorCounter = new Counter({
  name: 'constellation_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code', 'librarian', 'recoverable'],
});

/**
 * Performance SLA metrics
 */
export const slaViolations = new Counter({
  name: 'constellation_sla_violations_total',
  help: 'Total number of SLA violations',
  labelNames: ['type', 'threshold'], // type: response_time, qps
});

export const currentQPS = new Gauge({
  name: 'constellation_current_qps',
  help: 'Current queries per second',
});

// Track QPS with a sliding window
let queryTimestamps: number[] = [];
const QPS_WINDOW_SIZE = 60000; // 1 minute window

/**
 * Record a query and update QPS
 */
export function recordQuery(): void {
  const now = Date.now();
  queryTimestamps.push(now);

  // Remove timestamps older than window
  queryTimestamps = queryTimestamps.filter((ts) => now - ts < QPS_WINDOW_SIZE);

  // Calculate current QPS
  const qps = (queryTimestamps.length / QPS_WINDOW_SIZE) * 1000;
  currentQPS.set(qps);

  // Check QPS SLA (1000 QPS)
  if (qps > 1000) {
    slaViolations.inc({ type: 'qps', threshold: '1000' });
  }
}

/**
 * Record query duration and check SLA
 */
export function recordQueryDuration(
  duration: number,
  labels: { librarian: string; status: string },
): void {
  queryDuration.observe(labels, duration);

  // Check response time SLA (2s at p99)
  if (duration > 2) {
    slaViolations.inc({ type: 'response_time', threshold: '2s' });
  }
}

/**
 * Helper to record response metrics
 */
export function recordResponseMetrics(
  response: Response,
  librarian: string,
  aggregationStrategy?: string,
): void {
  if (response.confidence !== undefined) {
    responseConfidence.observe(
      { librarian, aggregation_strategy: aggregationStrategy || 'none' },
      response.confidence,
    );
  }

  if (response.sources) {
    responseSourceCount.observe({ librarian }, response.sources.length);
  }
}

/**
 * Initialize metrics endpoint
 */
export function initializeMetricsEndpoint(app: any, port: number = 9090): void {
  // Metrics endpoint
  app.get('/metrics', async (_req: any, res: any) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).end(error);
    }
  });

  logger.info('Prometheus metrics endpoint initialized', {
    endpoint: '/metrics',
    port,
  });
}

/**
 * Get the Prometheus registry for custom metrics
 */
export function getMetricsRegistry(): typeof register {
  return register;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.clear();
  queryTimestamps = [];

  // Re-initialize default metrics
  collectDefaultMetrics({
    prefix: 'constellation_',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  });
}

/**
 * Convenience functions for common metric patterns
 */

/**
 * Time a function execution and record metrics
 */
export async function timeExecution<T>(
  metricHistogram: Histogram<string>,
  labels: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> {
  const timer = metricHistogram.startTimer(labels);
  try {
    return await fn();
  } finally {
    timer();
  }
}

/**
 * Increment error counter with standard labels
 */
export function recordError(
  error: any,
  context: {
    type: string;
    librarian?: string;
    recoverable?: boolean;
  },
): void {
  const errorCode = error?.code || error?.name || 'UNKNOWN';
  errorCounter.inc({
    type: context.type,
    code: errorCode,
    librarian: context.librarian || 'unknown',
    recoverable: String(context.recoverable ?? false),
  });
}

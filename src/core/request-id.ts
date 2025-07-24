/**
 * Request ID generation and management
 * Provides unique request identifiers for tracing requests across the system
 */

import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import type { Context } from '../types/core';

// AsyncLocalStorage for request context
const requestContext = new AsyncLocalStorage<string>();

/**
 * Generate a new request ID
 * Format: req_<timestamp>_<random>
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomUUID().split('-')[0];
  return `req_${timestamp}_${random}`;
}

/**
 * Get the current request ID from async context
 */
export function getCurrentRequestId(): string | undefined {
  return requestContext.getStore();
}

/**
 * Run a function with a request ID in context
 */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return requestContext.run(requestId, fn);
}

/**
 * Middleware to add request ID to Context
 */
export function enrichContextWithRequestId(context: Context): Context {
  // Use existing request ID or generate new one
  const requestId = context.requestId || getCurrentRequestId() || generateRequestId();

  return {
    ...context,
    requestId,
  };
}

/**
 * Express middleware for request ID
 */
export function requestIdMiddleware(req: any, res: any, next: any): void {
  // Check for existing request ID in headers
  const existingId =
    req.headers['x-request-id'] || req.headers['x-correlation-id'] || req.headers['x-trace-id'];

  const requestId = existingId || generateRequestId();

  // Store in request object
  req.requestId = requestId;

  // Add to response headers
  res.setHeader('X-Request-ID', requestId);

  // Run the rest of the request in context
  runWithRequestId(requestId, () => {
    next();
  });
}

/**
 * Extract request ID from various sources
 */
export function extractRequestId(source: any): string | undefined {
  if (!source) return undefined;

  // Direct property
  if (source.requestId) return source.requestId;

  // From headers (Express request)
  if (source.headers) {
    return (
      source.headers['x-request-id'] ||
      source.headers['x-correlation-id'] ||
      source.headers['x-trace-id']
    );
  }

  // From context
  if (source.context?.requestId) return source.context.requestId;

  return undefined;
}

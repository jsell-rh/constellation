/**
 * Core type definitions for Constellation
 * These types enforce compile-time safety for librarian implementations
 */

import type { AIClient as ConstellationAIClient } from '../ai/interface';
import type { CircuitBreakerConfig } from '../resilience/circuit-breaker';
import type { LibrarianCacheConfig } from '../cache/interface';

/**
 * The fundamental librarian function type.
 * All librarians must conform to this signature.
 * IMPORTANT: Librarians must NEVER throw exceptions - always return a Response object.
 */
export type Librarian = (query: string, context?: Context) => Promise<Response>;

/**
 * Response from a librarian function.
 * Must include at least one of: answer, delegate, or error.
 */
export interface Response {
  /** The answer to the query */
  answer?: string;

  /** Supporting sources for the answer */
  sources?: Source[];

  /** Request to delegate to another librarian */
  delegate?: DelegateRequest | DelegateRequest[];

  /** Confidence score (0-1) in the answer */
  confidence?: number;

  /** Error information if something went wrong */
  error?: ErrorInfo;

  /** Indicates this is a partial answer (more coming) */
  partial?: boolean;

  /** Additional metadata about the response */
  metadata?: Record<string, unknown>;
}

/**
 * Context provided to librarian functions
 */
export interface Context {
  /** Information about the current librarian */
  librarian?: LibrarianInfo;

  /** User making the request */
  user?: User;

  /** Distributed tracing context */
  trace?: TraceContext;

  /** Chain of librarians that led to this call (for loop detection) */
  delegationChain?: string[];

  /** AI client for LLM operations */
  ai?: ConstellationAIClient;

  /** Available librarians for delegation */
  availableDelegates?: Delegate[];

  /** Custom metadata */
  metadata?: Record<string, unknown>;

  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Information about a librarian
 */
export interface LibrarianInfo {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this librarian does */
  description: string;

  /** Hierarchical capabilities (e.g., ['kubernetes.operations.deployment']) */
  capabilities: string[];

  /** HTTP endpoint for remote librarians */
  endpoint?: string;

  /** Team that owns this librarian */
  team?: string;

  /** Parent librarian ID for hierarchies */
  parent?: string;

  /** Circuit breaker configuration for this librarian */
  circuitBreaker?: Partial<CircuitBreakerConfig>;

  /** Cache configuration for this librarian */
  cache?: LibrarianCacheConfig;
}

/**
 * User information
 */
export interface User {
  /** User ID */
  id: string;

  /** User email */
  email?: string;

  /** Teams the user belongs to */
  teams?: string[];

  /** User roles for authorization */
  roles?: string[];

  /** Additional user metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Distributed tracing context
 */
export interface TraceContext {
  /** Trace ID for the entire request flow */
  traceId: string;

  /** Current span ID */
  spanId: string;

  /** Parent span ID */
  parentSpanId?: string;

  /** Start time of the span */
  startTime: number;

  /** Trace attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Delegate information for available librarians
 */
export interface Delegate {
  /** Librarian ID */
  id: string;

  /** Librarian name */
  name: string;

  /** Capabilities */
  capabilities: string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request to delegate to another librarian
 */
export interface DelegateRequest {
  /** Target librarian ID */
  to: string;

  /** Refined query for the target (optional, uses original if not provided) */
  query?: string;

  /** Additional context to pass to the delegate */
  context?: Record<string, unknown>;

  /** Fallback librarian if primary fails */
  fallback?: string;
}

/**
 * Source attribution for answers
 */
export interface Source {
  /** Name of the source */
  name: string;

  /** URL to the source (if applicable) */
  url?: string;

  /** Type of source */
  type?: 'document' | 'api' | 'database' | 'cache';

  /** Relevance score (0-1) */
  relevance?: number;

  /** Timestamp when this source was accessed */
  timestamp?: number;
}

/**
 * Error information
 */
export interface ErrorInfo {
  /** Machine-readable error code */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Which librarian generated this error */
  librarian?: string;

  /** Original query that caused the error */
  query?: string;

  /** Whether this error is recoverable (can retry) */
  recoverable?: boolean;

  /** Helpful suggestion for the user */
  suggestion?: string;

  /** Additional error details */
  details?: Record<string, unknown>;
}

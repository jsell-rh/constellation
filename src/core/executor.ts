/**
 * Core executor for librarian functions
 * Handles execution, context enrichment, validation, and observability
 */

import { EventEmitter } from 'events';
import { ulid } from 'ulid';
import type { Librarian, Context, Response, TraceContext } from '../types/core';
import type { AIClient } from '../ai/interface';
import { isValidResponse } from '../types/librarian-factory';
import {
  withSpan,
  addSpanAttributes,
  addSpanEvent,
  getCurrentTraceId,
  getCurrentSpanId,
  SpanKind,
  librarianExecutions,
  librarianExecutionDuration,
  cacheHits,
  cacheMisses,
  recordError,
} from '../observability';
import { getCircuitBreakerManager } from '../resilience/circuit-breaker-manager';
import { getCacheManager } from '../cache/cache-manager';
import {
  createLogger,
  createContextLogger,
  PerformanceTimer,
  logPerformance,
} from '../observability/logger';

const moduleLogger = createLogger('executor');

export interface ExecutorOptions {
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Whether to validate responses */
  validateResponses?: boolean;
  /** AI client for LLM operations */
  aiClient?: AIClient;
}

export interface ExecuteEvent {
  query: string;
  context: Context;
  timestamp: number;
}

export interface CompleteEvent extends ExecuteEvent {
  response: Response;
  executionTimeMs: number;
}

export interface ErrorEvent extends ExecuteEvent {
  error: Error;
  response: Response;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Executes librarian functions with proper context and error handling
 */
export class LibrarianExecutor extends EventEmitter {
  private readonly options: Required<Omit<ExecutorOptions, 'aiClient'>>;
  private readonly aiClient?: AIClient;

  constructor(options: ExecutorOptions = {}) {
    super();
    this.options = {
      defaultTimeout: options.defaultTimeout ?? 30000,
      validateResponses: options.validateResponses ?? true,
    };
    if (options.aiClient) {
      this.aiClient = options.aiClient;
    }
  }

  /**
   * Execute a librarian function with enriched context
   */
  async execute(librarian: Librarian, query: string, context: Context = {}): Promise<Response> {
    const timer = new PerformanceTimer();
    const librarianId = context.librarian?.id || 'unknown';
    const logger = createContextLogger('executor', context);

    // Enrich context
    const enrichedContext: Context = {
      ...context,
      trace: context.trace ?? this.createTraceContext(),
    };

    // Add AI client if available
    if (this.aiClient) {
      enrichedContext.ai = this.aiClient;
    }

    // Log execution start
    logger.info(
      {
        librarianId,
        queryLength: query.length,
        hasUser: !!enrichedContext.user,
        hasAI: !!enrichedContext.ai,
      },
      'Starting librarian execution',
    );

    // Emit start event
    this.emit('execute:start', {
      query,
      context: enrichedContext,
      timestamp: Date.now(),
    } as ExecuteEvent);

    // Execute within an OpenTelemetry span
    return withSpan(
      `librarian.execute`,
      async (_span) => {
        // Add span attributes
        addSpanAttributes({
          'librarian.id': enrichedContext.librarian?.id || 'unknown',
          'librarian.name': enrichedContext.librarian?.name || 'unknown',
          'librarian.team': enrichedContext.librarian?.team || 'unknown',
          'query.text': query.substring(0, 100), // Truncate for privacy
          'query.length': query.length,
          'user.id': enrichedContext.user?.id || 'anonymous',
          'user.teams': enrichedContext.user?.teams?.join(',') || '',
        });

        try {
          // Execute with timeout if specified
          const timeout = context.timeout ?? this.options.defaultTimeout;

          addSpanEvent('librarian.execution.start');

          // Check cache first
          const cacheManager = getCacheManager();
          const cachedResponse = await cacheManager.get(librarianId, query, enrichedContext);

          if (cachedResponse) {
            addSpanEvent('cache.hit');
            addSpanAttributes({
              'cache.hit': true,
            });

            // Record cache hit metric
            cacheHits.inc({ librarian: librarianId, cache_type: 'response' });

            timer.mark('cache_hit');

            // Add cache metadata to response
            const responseWithMetadata: Response = {
              ...cachedResponse,
              metadata: {
                ...cachedResponse.metadata,
                cached: true,
                executionTimeMs: timer.getDuration(),
                traceId: enrichedContext.trace?.traceId,
              },
            };

            logger.info(
              {
                librarianId,
                cached: true,
                responseConfidence: cachedResponse.confidence,
              },
              'Returning cached response',
            );

            this.emit('execute:complete', {
              query,
              context: enrichedContext,
              timestamp: Date.now(),
              response: responseWithMetadata,
              executionTimeMs: timer.getDuration(),
            } as CompleteEvent);

            return responseWithMetadata;
          }

          addSpanEvent('cache.miss');
          addSpanAttributes({
            'cache.hit': false,
          });

          // Record cache miss metric
          cacheMisses.inc({ librarian: librarianId, cache_type: 'response' });

          timer.mark('cache_checked');

          // Get circuit breaker for this librarian
          const circuitBreakerConfig = context.librarian?.circuitBreaker;
          const circuitBreaker = getCircuitBreakerManager().getBreaker(
            librarianId,
            circuitBreakerConfig,
          );

          // Execute with circuit breaker protection
          const execTimer = librarianExecutionDuration.startTimer({
            librarian: librarianId,
            team: context.librarian?.team || 'unknown',
          });

          const response = await this.executeWithTimeout(
            circuitBreaker.execute(() => librarian(query, enrichedContext)),
            timeout,
          );

          execTimer(); // Record execution duration
          timer.mark('execution_complete');

          addSpanEvent('librarian.execution.complete');

          // Record execution metric
          librarianExecutions.inc({
            librarian: librarianId,
            team: context.librarian?.team || 'unknown',
            status: response.error ? 'error' : 'success',
          });

          // Validate response if enabled
          if (this.options.validateResponses) {
            const validation = this.validateResponse(response);
            if (!validation.isValid) {
              addSpanEvent('response.validation.failed', {
                error: validation.error,
              });
              return this.createErrorResponse(
                'INVALID_RESPONSE',
                validation.error ?? 'Invalid response',
                {
                  query,
                  librarian: context.librarian?.id,
                  response,
                },
              );
            }
          }

          // Cache the response (async, don't wait)
          void cacheManager.set(librarianId, query, enrichedContext, response).catch((error) => {
            moduleLogger.warn(
              {
                err: error,
                librarianId,
                errorCode: 'CACHE_SET_FAILED',
                errorType: 'CACHE_ERROR',
                recoverable: true,
              },
              'Failed to cache response',
            );
          });

          // Add execution metadata
          const executionTimeMs = timer.getDuration();
          const enhancedResponse: Response = {
            ...response,
            metadata: {
              ...response.metadata,
              cached: false,
              executionTimeMs,
              traceId: enrichedContext.trace?.traceId,
            },
          };

          // Log successful execution
          logPerformance(logger, 'librarian.execute', timer, {
            librarianId,
            responseType: response.answer ? 'answer' : response.delegate ? 'delegate' : 'error',
            confidence: response.confidence,
            sourceCount: response.sources?.length,
          });

          // Add response attributes to span
          addSpanAttributes({
            'response.has_answer': !!enhancedResponse.answer,
            'response.has_error': !!enhancedResponse.error,
            'response.has_delegate': !!enhancedResponse.delegate,
            'response.confidence': enhancedResponse.confidence || 0,
            'response.execution_time_ms': executionTimeMs,
          });

          // Emit complete event
          this.emit('execute:complete', {
            query,
            context: enrichedContext,
            timestamp: Date.now(),
            response: enhancedResponse,
            executionTimeMs,
          } as CompleteEvent);

          return enhancedResponse;
        } catch (error) {
          timer.mark('error');
          addSpanEvent('librarian.execution.error', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          logger.error(
            {
              err: error,
              librarianId,
              errorType: 'EXECUTION_ERROR',
              recoverable: error instanceof Error && error.message.includes('timeout'),
            },
            'Librarian execution failed',
          );

          // Check if it's a circuit breaker error (already a Response)
          if (
            error &&
            typeof error === 'object' &&
            'error' in error &&
            isValidResponse(error as Response)
          ) {
            return error as Response;
          }

          const errorResponse = this.handleExecutionError(error as Error, query, enrichedContext);

          // Record error metric
          recordError(error, {
            type: 'librarian_execution',
            librarian: librarianId,
            ...(errorResponse.error?.recoverable !== undefined && {
              recoverable: errorResponse.error.recoverable,
            }),
          });

          // Record failed execution
          librarianExecutions.inc({
            librarian: librarianId,
            team: context.librarian?.team || 'unknown',
            status: 'error',
          });

          // Emit error event
          this.emit('execute:error', {
            query,
            context: enrichedContext,
            timestamp: Date.now(),
            error: error as Error,
            response: errorResponse,
          } as ErrorEvent);

          return errorResponse;
        }
      },
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          component: 'librarian-executor',
        },
      },
    );
  }

  /**
   * Create a new trace context using OpenTelemetry or generate one
   */
  createTraceContext(parentTrace?: TraceContext): TraceContext {
    // If parent trace is provided, preserve its trace ID
    if (parentTrace) {
      return {
        traceId: parentTrace.traceId,
        spanId: this.generateId(),
        parentSpanId: parentTrace.spanId,
        startTime: Date.now(),
      };
    }

    // Try to use OpenTelemetry trace context first
    const otelTraceId = getCurrentTraceId();
    const otelSpanId = getCurrentSpanId();

    if (otelTraceId && otelSpanId) {
      return {
        traceId: otelTraceId,
        spanId: otelSpanId,
        startTime: Date.now(),
      };
    }

    return {
      traceId: this.generateId(),
      spanId: this.generateId(),
      startTime: Date.now(),
    };
  }

  /**
   * Validate a response object
   */
  validateResponse(response: Response): ValidationResult {
    if (!isValidResponse(response)) {
      return {
        isValid: false,
        error: 'Response must contain at least one of: answer, delegate, or error',
      };
    }

    return { isValid: true };
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Handle execution errors
   */
  private handleExecutionError(error: Error, query: string, context: Context): Response {
    const logger = createContextLogger('executor', context);
    // Handle timeout errors specifically
    if (error.message.includes('timeout')) {
      logger.warn(
        {
          librarianId: context.librarian?.id,
          timeout: context.timeout ?? this.options.defaultTimeout,
          errorCode: 'TIMEOUT',
          errorType: 'TIMEOUT_ERROR',
          recoverable: true,
        },
        'Librarian execution timed out',
      );

      return this.createErrorResponse('TIMEOUT', error.message, {
        query,
        librarian: context.librarian?.id,
        timeout: context.timeout ?? this.options.defaultTimeout,
      });
    }

    // This should rarely happen as createLibrarian catches errors
    // But we handle it as a safety net
    logger.error(
      {
        err: error,
        librarianId: context.librarian?.id,
        errorCode: 'EXECUTOR_ERROR',
        errorType: error.constructor.name,
        recoverable: false,
      },
      'Unexpected executor error',
    );

    return this.createErrorResponse('EXECUTOR_ERROR', error.message, {
      query,
      librarian: context.librarian?.id,
      errorType: error.constructor.name,
      stack: error.stack,
    });
  }

  /**
   * Create an error response
   */
  private createErrorResponse(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ): Response {
    return {
      error: {
        code,
        message,
        recoverable: code === 'TIMEOUT',
        ...details,
      },
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return ulid();
  }
}

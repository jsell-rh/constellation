/**
 * Core executor for librarian functions
 * Handles execution, context enrichment, validation, and observability
 */

import { EventEmitter } from 'events';
import { ulid } from "ulid";
import type { Librarian, Context, Response, TraceContext } from '../types/core';
import type { AIClient } from '../ai/interface';
import { isValidResponse } from '../types/librarian-factory';

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
  async execute(
    librarian: Librarian,
    query: string,
    context: Context = {},
  ): Promise<Response> {
    const startTime = Date.now();
    
    // Enrich context
    const enrichedContext: Context = {
      ...context,
      trace: context.trace ?? this.createTraceContext(),
    };
    
    // Add AI client if available
    if (this.aiClient) {
      enrichedContext.ai = this.aiClient;
    }

    // Emit start event
    this.emit('execute:start', {
      query,
      context: enrichedContext,
      timestamp: startTime,
    } as ExecuteEvent);

    try {
      // Execute with timeout if specified
      const timeout = context.timeout ?? this.options.defaultTimeout;
      const response = await this.executeWithTimeout(
        librarian(query, enrichedContext),
        timeout,
        query,
      );

      // Validate response if enabled
      if (this.options.validateResponses) {
        const validation = this.validateResponse(response);
        if (!validation.isValid) {
          return this.createErrorResponse('INVALID_RESPONSE', validation.error ?? 'Invalid response', {
            query,
            librarian: context.librarian?.id,
            response,
          });
        }
      }

      // Add execution metadata
      const executionTimeMs = Date.now() - startTime;
      const enhancedResponse: Response = {
        ...response,
        metadata: {
          ...response.metadata,
          executionTimeMs,
        },
      };

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
      const errorResponse = this.handleExecutionError(error as Error, query, enrichedContext);
      
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
  }

  /**
   * Create a new trace context or child span
   */
  createTraceContext(parentTrace?: TraceContext): TraceContext {
    if (parentTrace) {
      return {
        traceId: parentTrace.traceId,
        spanId: this.generateId(),
        parentSpanId: parentTrace.spanId,
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
  private async executeWithTimeout(
    promise: Promise<Response>,
    timeoutMs: number,
    query: string,
  ): Promise<Response> {
    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        return this.createErrorResponse('TIMEOUT', error.message, {
          query,
          timeoutMs,
        });
      }
      throw error;
    }
  }

  /**
   * Handle execution errors
   */
  private handleExecutionError(error: Error, query: string, context: Context): Response {
    // This should rarely happen as createLibrarian catches errors
    // But we handle it as a safety net
    return this.createErrorResponse(
      'EXECUTOR_ERROR',
      error.message,
      {
        query,
        librarian: context.librarian?.id,
        errorType: error.constructor.name,
        stack: error.stack,
      },
    );
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
/**
 * Factory for creating type-safe librarian functions
 * Ensures all librarians follow the Response pattern and never throw
 */

import type { Librarian, Response, Context } from './core';

/**
 * Type for the implementation function passed to createLibrarian
 * This enforces that implementations must return Promise<Response>
 */
export type LibrarianImplementation = (query: string, context?: Context) => Promise<Response>;

/**
 * Creates a type-safe librarian function that guarantees:
 * 1. Always returns a Response object
 * 2. Never throws uncaught exceptions
 * 3. Validates response structure
 * 
 * @param implementation The librarian logic that must return a Response
 * @returns A Librarian function that safely executes the implementation
 * 
 * @example
 * ```typescript
 * const myLibrarian = createLibrarian(async (query, context) => {
 *   // Implementation can focus on logic, not error handling
 *   const result = await processQuery(query);
 *   return { answer: result };
 * });
 * ```
 */
export function createLibrarian(implementation: LibrarianImplementation): Librarian {
  return async (query: string, context?: Context): Promise<Response> => {
    try {
      // Execute the implementation
      const response = await implementation(query, context);
      
      // Validate the response has at least one valid field
      if (response.answer === undefined && response.delegate === undefined && response.error === undefined) {
        return {
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Response must contain at least one of: answer, delegate, or error',
            ...(context?.librarian?.id !== undefined && { librarian: context.librarian.id }),
            query,
            recoverable: false,
            details: {
              receivedResponse: response,
            },
          },
        };
      }
      
      return response;
    } catch (error) {
      // Convert any thrown error to a Response with error field
      return {
        error: {
          code: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          ...(context?.librarian?.id !== undefined && { librarian: context.librarian.id }),
          query,
          recoverable: false,
          suggestion: 'This is an internal error. Please contact support if it persists.',
          details: {
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            ...(!(error instanceof Error) && { thrown: error }),
            ...(error instanceof Error && error.stack !== undefined && { stack: error.stack }),
          },
        },
      };
    }
  };
}

/**
 * Type guard to check if a value is a valid Response
 */
export function isValidResponse(value: unknown): value is Response {
  if (value === null || value === undefined || typeof value !== 'object') {
    return false;
  }
  
  const response = value as Response;
  return response.answer !== undefined || response.delegate !== undefined || response.error !== undefined;
}

/**
 * Helper to create an error response
 */
export function errorResponse(
  code: string,
  message: string,
  options?: {
    librarian?: string;
    query?: string;
    recoverable?: boolean;
    suggestion?: string;
    details?: Record<string, unknown>;
  },
): Response {
  return {
    error: {
      code,
      message,
      ...options,
    },
  };
}

/**
 * Helper to create a success response
 */
export function successResponse(
  answer: string,
  options?: {
    sources?: Response['sources'];
    confidence?: number;
    metadata?: Record<string, unknown>;
  },
): Response {
  const response: Response = { answer };
  
  if (options?.sources) {
    response.sources = options.sources;
  }
  if (options?.confidence !== undefined) {
    response.confidence = options.confidence;
  }
  if (options?.metadata) {
    response.metadata = options.metadata;
  }
  
  return response;
}

/**
 * Helper to create a delegation response
 */
export function delegateResponse(
  to: string,
  options?: {
    query?: string;
    context?: Record<string, unknown>;
    fallback?: string;
  },
): Response {
  return {
    delegate: {
      to,
      ...options,
    },
  };
}
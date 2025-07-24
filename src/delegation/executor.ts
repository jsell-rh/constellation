/**
 * Executes delegation requests from librarians
 */

import type { SimpleRouter } from '../core/router';
import type { Context, Response, DelegateRequest } from '../types/core';
import { errorResponse } from '../types/librarian-factory';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

const MAX_DELEGATION_DEPTH = 5;

export interface DelegationContext extends Context {
  originalQuery?: string;
  delegationChain?: string[];
  delegationDepth?: number;
  deadline?: number;
  remainingTimeout?: number;
}

export class DelegationExecutor {
  constructor(private router: SimpleRouter) {}

  /**
   * Execute a query, handling any delegation responses
   */
  async execute(query: string, librarianId: string, context: Context): Promise<Response> {
    // Calculate deadline if timeout is provided
    const deadline = context.timeout ? Date.now() + context.timeout : undefined;

    const delegationContext: DelegationContext = {
      ...context,
      originalQuery: query,
      delegationChain: [],
      delegationDepth: 0,
      ...(deadline !== undefined && { deadline }),
      ...(context.timeout !== undefined && { remainingTimeout: context.timeout }),
    };

    return this.executeWithDelegation(query, librarianId, delegationContext);
  }

  private async executeWithDelegation(
    query: string,
    librarianId: string,
    context: DelegationContext,
  ): Promise<Response> {
    // Check if we've exceeded the deadline
    if (context.deadline && Date.now() >= context.deadline) {
      return errorResponse('TIMEOUT_EXCEEDED', 'Request timeout exceeded before execution');
    }

    // Check delegation depth
    if ((context.delegationDepth ?? 0) >= MAX_DELEGATION_DEPTH) {
      return errorResponse(
        'MAX_DELEGATION_DEPTH_EXCEEDED',
        `Maximum delegation depth of ${MAX_DELEGATION_DEPTH} exceeded`,
      );
    }

    // Check for loops
    if (context.delegationChain?.includes(librarianId)) {
      return errorResponse(
        'DELEGATION_LOOP_DETECTED',
        `Delegation loop detected: ${context.delegationChain.join(' -> ')} -> ${librarianId}`,
      );
    }

    // Calculate remaining timeout
    const remainingTimeout = context.deadline
      ? Math.max(0, context.deadline - Date.now())
      : context.timeout;

    // Update delegation chain and timeout
    const updatedContext: DelegationContext = {
      ...context,
      delegationChain: [...(context.delegationChain ?? []), librarianId],
      delegationDepth: (context.delegationDepth ?? 0) + 1,
      ...(remainingTimeout !== undefined && {
        timeout: remainingTimeout,
        remainingTimeout,
      }),
    };

    try {
      // Execute the librarian with timeout
      const startTime = Date.now();

      const executePromise = this.router.route(query, librarianId, updatedContext);

      let response: Response;
      if (remainingTimeout && remainingTimeout > 0) {
        // Use Promise.race to implement timeout
        const timeoutPromise = new Promise<Response>((_, reject) => {
          setTimeout(() => reject(new Error('Librarian execution timeout')), remainingTimeout);
        });

        try {
          response = await Promise.race([executePromise, timeoutPromise]);
        } catch (error) {
          if (error instanceof Error && error.message === 'Librarian execution timeout') {
            return errorResponse(
              'LIBRARIAN_TIMEOUT',
              `Librarian '${librarianId}' execution timed out after ${remainingTimeout}ms`,
            );
          }
          throw error;
        }
      } else {
        response = await executePromise;
      }

      const executionTime = Date.now() - startTime;

      // If response contains delegation, execute it
      if (response.delegate) {
        const delegateRequest = response.delegate as DelegateRequest;

        // Check if target exists
        if (!this.router.getAllLibrarians().includes(delegateRequest.to)) {
          return errorResponse(
            'DELEGATION_TARGET_NOT_FOUND',
            `Delegation target '${delegateRequest.to}' not found`,
          );
        }

        logger.info(
          {
            from: librarianId,
            to: delegateRequest.to,
            chain: updatedContext.delegationChain,
            reason: delegateRequest.context?.reason,
          },
          'Executing delegation',
        );

        // Execute the delegation
        const delegatedQuery = delegateRequest.query ?? query;
        const delegatedResponse = await this.executeWithDelegation(
          delegatedQuery,
          delegateRequest.to,
          updatedContext,
        );

        // Add delegation metadata
        return {
          ...delegatedResponse,
          metadata: {
            ...delegatedResponse.metadata,
            delegated: true,
            delegationChain: [...(updatedContext.delegationChain ?? []), delegateRequest.to],
            delegationReason: delegateRequest.context?.reason,
            executionTime: Date.now() - startTime,
          },
        };
      }

      // No delegation, return response with metadata
      return {
        ...response,
        metadata: {
          ...response.metadata,
          delegationChain: context.delegationChain,
          executionTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          error,
          librarianId,
          query,
          chain: context.delegationChain,
        },
        'Error executing librarian',
      );

      return {
        error: {
          code: 'EXECUTION_ERROR',
          message: errorMessage,
        },
        metadata: {
          delegationChain: updatedContext.delegationChain,
        },
      };
    }
  }
}

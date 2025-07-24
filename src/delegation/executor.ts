/**
 * Executes delegation requests from librarians
 */

import type { SimpleRouter } from '../core/router';
import type { Context, Response, DelegateRequest } from '../types/core';
import { errorResponse } from '../types/librarian-factory';
import { createContextLogger, PerformanceTimer } from '../observability/logger';

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
    const logger = createContextLogger('delegation-executor', context);
    const timer = new PerformanceTimer();

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

    logger.info(
      {
        librarianId,
        queryLength: query.length,
        hasTimeout: !!context.timeout,
        timeout: context.timeout,
      },
      'Starting delegation execution',
    );

    const response = await this.executeWithDelegation(query, librarianId, delegationContext);

    logger.info(
      {
        librarianId,
        executionTimeMs: timer.getDuration(),
        delegationDepth: delegationContext.delegationDepth,
        responseType: response.answer ? 'answer' : response.delegate ? 'delegate' : 'error',
      },
      'Delegation execution completed',
    );

    return response;
  }

  private async executeWithDelegation(
    query: string,
    librarianId: string,
    context: DelegationContext,
  ): Promise<Response> {
    const logger = createContextLogger('delegation-executor', context);
    const timer = new PerformanceTimer();

    // Check if we've exceeded the deadline
    if (context.deadline && Date.now() >= context.deadline) {
      logger.warn(
        {
          librarianId,
          deadline: context.deadline,
          currentTime: Date.now(),
          errorCode: 'TIMEOUT_EXCEEDED',
          errorType: 'TIMEOUT_ERROR',
        },
        'Request timeout exceeded before execution',
      );

      return errorResponse('TIMEOUT_EXCEEDED', 'Request timeout exceeded before execution');
    }

    // Check delegation depth
    if ((context.delegationDepth ?? 0) >= MAX_DELEGATION_DEPTH) {
      logger.warn(
        {
          librarianId,
          delegationDepth: context.delegationDepth,
          maxDepth: MAX_DELEGATION_DEPTH,
          delegationChain: context.delegationChain,
          errorCode: 'MAX_DELEGATION_DEPTH_EXCEEDED',
        },
        'Maximum delegation depth exceeded',
      );

      return errorResponse(
        'MAX_DELEGATION_DEPTH_EXCEEDED',
        `Maximum delegation depth of ${MAX_DELEGATION_DEPTH} exceeded`,
      );
    }

    // Check for loops
    if (context.delegationChain?.includes(librarianId)) {
      logger.warn(
        {
          librarianId,
          delegationChain: context.delegationChain,
          errorCode: 'DELEGATION_LOOP_DETECTED',
          errorType: 'LOOP_ERROR',
        },
        'Delegation loop detected',
      );

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
      timer.mark('execution_start');

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
            logger.warn(
              {
                librarianId,
                remainingTimeout,
                errorCode: 'LIBRARIAN_TIMEOUT',
                errorType: 'TIMEOUT_ERROR',
                recoverable: true,
              },
              'Librarian execution timed out',
            );

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

      timer.mark('execution_complete');
      const executionTime = timer.getDurationBetween('execution_start', 'execution_complete');

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
            fromLibrarian: librarianId,
            toLibrarian: delegateRequest.to,
            delegationChain: updatedContext.delegationChain,
            delegationDepth: updatedContext.delegationDepth,
            reason: delegateRequest.context?.reason,
            remainingTimeout,
          },
          'Executing delegation',
        );

        // Execute the delegation
        timer.mark('delegation_start');
        const delegatedQuery = delegateRequest.query ?? query;
        const delegatedResponse = await this.executeWithDelegation(
          delegatedQuery,
          delegateRequest.to,
          updatedContext,
        );
        timer.mark('delegation_complete');

        // Add delegation metadata
        return {
          ...delegatedResponse,
          metadata: {
            ...delegatedResponse.metadata,
            delegated: true,
            delegationChain: [...(updatedContext.delegationChain ?? []), delegateRequest.to],
            delegationReason: delegateRequest.context?.reason,
            executionTime: timer.getDuration(),
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
          err: error,
          librarianId,
          queryLength: query.length,
          delegationChain: context.delegationChain,
          delegationDepth: context.delegationDepth,
          errorCode: 'EXECUTION_ERROR',
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          recoverable: false,
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

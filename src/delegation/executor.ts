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
}

export class DelegationExecutor {
  constructor(private router: SimpleRouter) {}

  /**
   * Execute a query, handling any delegation responses
   */
  async execute(query: string, librarianId: string, context: Context): Promise<Response> {
    const delegationContext: DelegationContext = {
      ...context,
      originalQuery: query,
      delegationChain: [],
      delegationDepth: 0,
    };

    return this.executeWithDelegation(query, librarianId, delegationContext);
  }

  private async executeWithDelegation(
    query: string,
    librarianId: string,
    context: DelegationContext,
  ): Promise<Response> {
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

    // Update delegation chain
    const updatedContext: DelegationContext = {
      ...context,
      delegationChain: [...(context.delegationChain ?? []), librarianId],
      delegationDepth: (context.delegationDepth ?? 0) + 1,
    };

    try {
      // Execute the librarian
      const startTime = Date.now();
      const response = await this.router.route(query, librarianId, updatedContext);
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

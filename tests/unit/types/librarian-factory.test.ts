import { describe, it, expect } from '@jest/globals';
import { createLibrarian } from '../../../src/types/librarian-factory';
import type { Response, Context } from '../../../src/types/core';

/* eslint-disable @typescript-eslint/require-await */

describe('Librarian Factory', () => {
  describe('createLibrarian', () => {
    it('should create a librarian that returns a Response', async () => {
      const librarian = createLibrarian(async (query: string) => {
        return { answer: `You asked: ${query}` };
      });

      const response = await librarian('test query');
      expect(response.answer).toBe('You asked: test query');
    });

    it('should pass context through to the implementation', async () => {
      const mockContext: Context = {
        user: { id: 'user123' },
        trace: { traceId: 'trace123', spanId: 'span456', startTime: Date.now() },
      };

      const librarian = createLibrarian(async (_query: string, context?: Context) => {
        return {
          answer: 'test',
          metadata: { userId: context?.user?.id },
        };
      });

      const response = await librarian('test', mockContext);
      expect(response.metadata?.userId).toBe('user123');
    });

    it('should catch thrown errors and convert to error response', async () => {
      const librarian = createLibrarian(async () => {
        throw new Error('Implementation error');
      });

      const response = await librarian('test');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('UNEXPECTED_ERROR');
      expect(response.error?.message).toContain('Implementation error');
    });

    it('should handle non-Error thrown values', async () => {
      const librarian = createLibrarian(async () => {
        // eslint-disable-next-line no-throw-literal
        throw 'string error';
      });

      const response = await librarian('test');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('UNEXPECTED_ERROR');
      expect(response.error?.details?.thrown).toBe('string error');
    });

    it('should preserve the original query in error responses', async () => {
      const testQuery = 'test query that fails';
      const librarian = createLibrarian(async () => {
        throw new Error('Failed');
      });

      const response = await librarian(testQuery);
      expect(response.error?.query).toBe(testQuery);
    });

    it('should mark unexpected errors as not recoverable', async () => {
      const librarian = createLibrarian(async () => {
        throw new Error('Unexpected');
      });

      const response = await librarian('test');
      expect(response.error?.recoverable).toBe(false);
    });

    it('should include librarian ID in error if provided in context', async () => {
      const context: Context = {
        librarian: {
          id: 'test-librarian',
          name: 'Test',
          description: 'Test librarian',
          capabilities: [],
        },
      };

      const librarian = createLibrarian(async () => {
        throw new Error('Failed');
      });

      const response = await librarian('test', context);
      expect(response.error?.librarian).toBe('test-librarian');
    });

    it('should handle Promise rejection', async () => {
      const librarian = createLibrarian(async () => {
        return Promise.reject(new Error('Rejected'));
      });

      const response = await librarian('test');
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Rejected');
    });

    it('should allow successful delegation responses', async () => {
      const librarian = createLibrarian(async (query: string) => {
        if (query.includes('complex')) {
          return {
            delegate: {
              to: 'expert-librarian',
              query: 'simplified query',
            },
          };
        }
        return { answer: 'Simple answer' };
      });

      const response = await librarian('complex question');
      expect(response.delegate).toBeDefined();
      expect((response.delegate as { to: string }).to).toBe('expert-librarian');
    });

    it('should validate that at least one response field is present', async () => {
      const librarian = createLibrarian(async () => {
        // Return empty object (invalid response)
        return {} as Response;
      });

      const response = await librarian('test');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('INVALID_RESPONSE');
      expect(response.error?.message).toContain('must contain');
    });
  });

  describe('Type Safety', () => {
    it('should enforce Response return type at compile time', () => {
      // This test verifies TypeScript compilation
      const librarian = createLibrarian(async (_query: string) => {
        // The following would cause compile errors if uncommented:
        // return "string"; // Type error
        // return 123; // Type error
        // return null; // Type error
        return { answer: 'valid response' };
      });

      expect(typeof librarian).toBe('function');
    });

    it('should maintain type inference for the implementation', () => {
      const librarian = createLibrarian(async (query, context) => {
        // TypeScript should infer query as string and context as Context | undefined
        const upperQuery = query.toUpperCase();
        const userId = context?.user?.id;
        
        return {
          answer: upperQuery,
          metadata: { userId },
        };
      });

      expect(typeof librarian).toBe('function');
    });
  });
});
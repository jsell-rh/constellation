/* eslint-disable @typescript-eslint/require-await */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LibrarianExecutor } from '../../../src/core/executor';
import { createLibrarian } from '../../../src/types/librarian-factory';
import type { Librarian, Context, Response } from '../../../src/types/core';

describe('LibrarianExecutor', () => {
  let executor: LibrarianExecutor;

  beforeEach(() => {
    executor = new LibrarianExecutor();
  });

  describe('execute', () => {
    it('should execute a simple librarian and return response', async () => {
      const librarian = createLibrarian(async (query: string) => {
        return { answer: `Echo: ${query}` };
      });

      const response = await executor.execute(librarian, 'test query');
      expect(response.answer).toBe('Echo: test query');
    });

    it('should add trace context if not provided', async () => {
      let capturedContext: Context | undefined;
      const librarian = createLibrarian(async (_query: string, context?: Context) => {
        capturedContext = context;
        return { answer: 'test' };
      });

      await executor.execute(librarian, 'test');
      
      expect(capturedContext?.trace).toBeDefined();
      expect(capturedContext?.trace?.traceId).toBeDefined();
      expect(capturedContext?.trace?.spanId).toBeDefined();
      expect(capturedContext?.trace?.startTime).toBeDefined();
    });

    it('should preserve existing trace context', async () => {
      const existingTrace = {
        traceId: 'existing-trace',
        spanId: 'existing-span',
        startTime: Date.now(),
      };

      let capturedContext: Context | undefined;
      const librarian = createLibrarian(async (_query: string, context?: Context) => {
        capturedContext = context;
        return { answer: 'test' };
      });

      await executor.execute(librarian, 'test', { trace: existingTrace });
      
      expect(capturedContext?.trace?.traceId).toBe('existing-trace');
      expect(capturedContext?.trace?.spanId).toBe('existing-span');
    });

    it('should enrich context with additional metadata', async () => {
      let capturedContext: Context | undefined;
      const librarian = createLibrarian(async (_query: string, context?: Context) => {
        capturedContext = context;
        return { answer: 'test' };
      });

      const inputContext: Context = {
        user: { id: 'user123' },
        metadata: { source: 'api' },
      };

      await executor.execute(librarian, 'test', inputContext);
      
      expect(capturedContext?.user?.id).toBe('user123');
      expect(capturedContext?.metadata?.source).toBe('api');
      expect(capturedContext?.trace).toBeDefined();
    });

    it('should handle librarian that returns error response', async () => {
      const librarian = createLibrarian(async () => {
        return {
          error: {
            code: 'TEST_ERROR',
            message: 'Test error message',
          },
        };
      });

      const response = await executor.execute(librarian, 'test');
      expect(response.error?.code).toBe('TEST_ERROR');
      expect(response.error?.message).toBe('Test error message');
    });

    it('should handle librarian that throws (caught by createLibrarian)', async () => {
      const librarian = createLibrarian(async () => {
        throw new Error('Unexpected error');
      });

      const response = await executor.execute(librarian, 'test');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('UNEXPECTED_ERROR');
      expect(response.error?.message).toContain('Unexpected error');
    });

    it('should validate response has required fields', async () => {
      // This is handled by createLibrarian, but executor should also validate
      const malformedLibrarian: Librarian = async () => {
        return {} as Response; // Invalid response
      };

      const response = await executor.execute(malformedLibrarian, 'test');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('INVALID_RESPONSE');
    });

    it('should include execution time in metadata', async () => {
      const librarian = createLibrarian(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { answer: 'delayed response' };
      });

      const response = await executor.execute(librarian, 'test');
      expect(response.metadata?.executionTimeMs).toBeDefined();
      expect(response.metadata?.executionTimeMs).toBeGreaterThan(40);
    });

    it('should handle delegation response', async () => {
      const librarian = createLibrarian(async () => {
        return {
          delegate: {
            to: 'expert-librarian',
            query: 'refined query',
          },
        };
      });

      const response = await executor.execute(librarian, 'test');
      expect(response.delegate).toBeDefined();
      expect((response.delegate as { to: string }).to).toBe('expert-librarian');
    });

    it('should add librarian info to context if provided', async () => {
      let capturedContext: Context | undefined;
      const librarian = createLibrarian(async (_query: string, context?: Context) => {
        capturedContext = context;
        return { answer: 'test' };
      });

      const librarianInfo = {
        id: 'test-lib',
        name: 'Test Librarian',
        description: 'A test librarian',
        capabilities: ['test'],
      };

      await executor.execute(librarian, 'test', { librarian: librarianInfo });
      
      expect(capturedContext?.librarian?.id).toBe('test-lib');
      expect(capturedContext?.librarian?.name).toBe('Test Librarian');
    });

    it('should handle timeout configuration', async () => {
      const librarian = createLibrarian(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { answer: 'delayed' };
      });

      const response = await executor.execute(librarian, 'test', { timeout: 100 });
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('TIMEOUT');
      expect(response.error?.message).toContain('timeout');
    });

    it('should emit events for observability', async () => {
      const emitSpy = jest.spyOn(executor, 'emit');
      
      const librarian = createLibrarian(async () => {
        return { answer: 'test' };
      });

      await executor.execute(librarian, 'test');
      
      expect(emitSpy).toHaveBeenCalledWith('execute:start', expect.any(Object));
      expect(emitSpy).toHaveBeenCalledWith('execute:complete', expect.any(Object));
    });

    it('should emit error event on failure', async () => {
      const emitSpy = jest.spyOn(executor, 'emit');
      
      // To trigger an executor error, we need a librarian that doesn't use createLibrarian
      const badLibrarian: Librarian = async () => {
        throw new Error('Test error');
      };

      await executor.execute(badLibrarian, 'test');
      
      expect(emitSpy).toHaveBeenCalledWith('execute:error', expect.any(Object));
    });
  });

  describe('createTraceContext', () => {
    it('should generate unique trace IDs', () => {
      const trace1 = executor.createTraceContext();
      const trace2 = executor.createTraceContext();
      
      expect(trace1.traceId).not.toBe(trace2.traceId);
      expect(trace1.spanId).not.toBe(trace2.spanId);
    });

    it('should create child spans when parent provided', () => {
      const parentTrace = {
        traceId: 'parent-trace',
        spanId: 'parent-span',
        startTime: Date.now(),
      };

      const childTrace = executor.createTraceContext(parentTrace);
      
      expect(childTrace.traceId).toBe('parent-trace');
      expect(childTrace.parentSpanId).toBe('parent-span');
      expect(childTrace.spanId).not.toBe('parent-span');
    });
  });

  describe('validateResponse', () => {
    it('should accept valid response with answer', () => {
      const response: Response = { answer: 'test' };
      const result = executor.validateResponse(response);
      expect(result.isValid).toBe(true);
    });

    it('should accept valid response with error', () => {
      const response: Response = {
        error: { code: 'ERROR', message: 'test' },
      };
      const result = executor.validateResponse(response);
      expect(result.isValid).toBe(true);
    });

    it('should accept valid response with delegate', () => {
      const response: Response = {
        delegate: { to: 'other-librarian' },
      };
      const result = executor.validateResponse(response);
      expect(result.isValid).toBe(true);
    });

    it('should reject empty response', () => {
      const response: Response = {};
      const result = executor.validateResponse(response);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must contain');
    });
  });
});
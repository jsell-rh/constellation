import { describe, it, expect } from '@jest/globals';
import type {
  Librarian,
  Context,
  Response,
  ErrorInfo,
  Source,
} from '../../../src/types/core';
import type { AIClient } from '../../../src/ai/interface';

/* eslint-disable @typescript-eslint/require-await */

describe('Core Types', () => {
  describe('Librarian Function Type', () => {
    it('should accept a function that returns a Promise<Response>', () => {
      const validLibrarian: Librarian = async (_query: string, _context?: Context) => {
        return { answer: 'test response' };
      };

      expect(typeof validLibrarian).toBe('function');
    });

    it('should enforce Response return type at compile time', () => {
      // This test verifies TypeScript compilation
      // The following would cause a compile error if uncommented:
      // const invalidLibrarian: Librarian = async (query: string) => {
      //   return "string instead of Response"; // Type error
      // };
      expect(true).toBe(true);
    });
  });

  describe('Response Type', () => {
    it('should allow answer-only response', () => {
      const response: Response = {
        answer: 'This is an answer',
      };
      expect(response.answer).toBe('This is an answer');
    });

    it('should allow error-only response', () => {
      const response: Response = {
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
        },
      };
      expect(response.error?.code).toBe('TEST_ERROR');
    });

    it('should allow delegate-only response', () => {
      const response: Response = {
        delegate: {
          to: 'expert-librarian',
          query: 'refined query',
        },
      };
      expect(response.delegate).toBeDefined();
    });

    it('should allow response with all optional fields', () => {
      const response: Response = {
        answer: 'Answer',
        sources: [{ name: 'Source 1', url: 'http://example.com' }],
        confidence: 0.95,
        partial: false,
        metadata: { key: 'value' },
      };
      expect(response.confidence).toBe(0.95);
    });

    it('should allow multiple delegate requests', () => {
      const response: Response = {
        delegate: [
          { to: 'librarian1' },
          { to: 'librarian2', query: 'specific query' },
        ],
      };
      expect(Array.isArray(response.delegate)).toBe(true);
    });
  });

  describe('Context Type', () => {
    it('should allow empty context', () => {
      const context: Context = {};
      expect(context).toBeDefined();
    });

    it('should support all context properties', () => {
      const context: Context = {
        librarian: {
          id: 'test-lib',
          name: 'Test Librarian',
          description: 'A test librarian',
          capabilities: ['test.capability'],
        },
        user: {
          id: 'user123',
          roles: ['admin'],
        },
        trace: {
          traceId: 'trace123',
          spanId: 'span456',
          startTime: Date.now(),
        },
        delegationChain: ['parent-lib', 'grandparent-lib'],
        ai: {
          defaultProvider: { name: 'mock', getSupportedModels: () => [], isAvailable: () => true, complete: async () => ({ content: '' }), stream: async () => ({ [Symbol.asyncIterator]: async function*() {} } as any), ask: async () => '' },
          providers: {},
          complete: async () => ({ content: 'AI response' }),
          stream: async () => ({ [Symbol.asyncIterator]: async function*() { yield 'response'; } } as any),
          ask: async () => 'AI response',
          completeWith: async () => ({ content: 'AI response' }),
          streamWith: async () => ({ [Symbol.asyncIterator]: async function*() { yield 'response'; } } as any),
          askWith: async () => 'AI response',
        } as AIClient,
        availableDelegates: [
          {
            id: 'delegate1',
            name: 'Delegate 1',
            capabilities: ['capability1'],
          },
        ],
        metadata: {
          custom: 'value',
        },
      };

      expect(context.librarian?.id).toBe('test-lib');
      expect(context.user?.id).toBe('user123');
      expect(context.trace?.traceId).toBe('trace123');
    });
  });

  describe('ErrorInfo Type', () => {
    it('should support all error fields', () => {
      const error: ErrorInfo = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        librarian: 'validator-lib',
        query: 'original query',
        recoverable: true,
        suggestion: 'Try reformatting your input',
        details: {
          field: 'query',
          reason: 'too short',
        },
      };

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.recoverable).toBe(true);
      expect((error.details as Record<string, unknown>)?.field).toBe('query');
    });
  });

  describe('Source Type', () => {
    it('should support various source types', () => {
      const sources: Source[] = [
        {
          name: 'Document',
          type: 'document',
          url: 'http://example.com/doc',
          relevance: 0.9,
          timestamp: Date.now(),
        },
        {
          name: 'API Response',
          type: 'api',
          relevance: 0.8,
        },
        {
          name: 'Database Query',
          type: 'database',
        },
        {
          name: 'Cached Result',
          type: 'cache',
          timestamp: Date.now() - 3600000,
        },
      ];

      expect(sources[0]?.type).toBe('document');
      expect(sources[1]?.relevance).toBe(0.8);
      expect(sources[3]?.type).toBe('cache');
    });
  });

  describe('AIClient Type', () => {
    it('should define required AI methods', () => {
      const mockAI: AIClient = {
        defaultProvider: { 
          name: 'mock', 
          getSupportedModels: () => [],
          isAvailable: () => true,
          complete: async () => ({ content: 'completion' }),
          stream: async () => ({ [Symbol.asyncIterator]: async function*() {} } as any),
          ask: async () => 'completion',
        },
        providers: {},
        complete: async () => ({ content: 'completion' }),
        stream: async () => ({ [Symbol.asyncIterator]: async function*() {} } as any),
        ask: async () => 'completion',
        completeWith: async () => ({ content: 'completion' }),
        streamWith: async () => ({ [Symbol.asyncIterator]: async function*() {} } as any),
        askWith: async () => 'completion',
      };

      expect(typeof mockAI.complete).toBe('function');
      expect(typeof mockAI.ask).toBe('function');
    });
  });
});
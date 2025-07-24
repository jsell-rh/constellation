/**
 * Tests for delegation executor timeout management
 */

import { DelegationExecutor } from '../../../src/delegation/executor';
import { SimpleRouter } from '../../../src/core/router';
import type { Context, LibrarianInfo } from '../../../src/types/core';
import { createLibrarian } from '../../../src/types/librarian-factory';

describe('DelegationExecutor Timeout Management', () => {
  let router: SimpleRouter;
  let executor: DelegationExecutor;

  beforeEach(() => {
    router = new SimpleRouter();
    executor = new DelegationExecutor(router);
  });

  describe('basic timeout', () => {
    it('should timeout if librarian takes too long', async () => {
      const slowMeta: LibrarianInfo = {
        id: 'slow',
        name: 'Slow Librarian',
        description: 'Takes too long',
        capabilities: [],
        team: 'test',
      };
      const slowLibrarian = createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { answer: 'Should not see this' };
      });
      router.register(slowMeta, slowLibrarian);

      const context: Context = { timeout: 50 };
      const response = await executor.execute('test', 'slow', context);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('LIBRARIAN_TIMEOUT');
      expect(response.error?.message).toMatch(/timed out after \d+ms/);
    });

    it('should succeed if completed within timeout', async () => {
      const fastMeta: LibrarianInfo = {
        id: 'fast',
        name: 'Fast Librarian',
        description: 'Quick response',
        capabilities: [],
        team: 'test',
      };
      const fastLibrarian = createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { answer: 'Fast response' };
      });
      router.register(fastMeta, fastLibrarian);

      const context: Context = { timeout: 100 };
      const response = await executor.execute('test', 'fast', context);

      expect(response.answer).toBe('Fast response');
      expect(response.error).toBeUndefined();
    });
  });

  describe('timeout propagation', () => {
    it('should reduce timeout for delegated calls', async () => {
      let capturedTimeout: number | undefined;

      // First librarian takes 50ms then delegates
      const firstMeta: LibrarianInfo = {
        id: 'first',
        name: 'First',
        description: 'Delegates after delay',
        capabilities: [],
        team: 'test',
      };
      const firstLibrarian = createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { delegate: { to: 'second' } };
      });
      router.register(firstMeta, firstLibrarian);

      // Second librarian captures the timeout it receives
      const secondMeta: LibrarianInfo = {
        id: 'second',
        name: 'Second',
        description: 'Captures timeout',
        capabilities: [],
        team: 'test',
      };
      const secondLibrarian = createLibrarian((_query: string, context?: Context) => {
        capturedTimeout = context?.timeout;
        return Promise.resolve({ answer: 'From second' });
      });
      router.register(secondMeta, secondLibrarian);

      const context: Context = { timeout: 200 };
      const response = await executor.execute('test', 'first', context);

      expect(response.answer).toBe('From second');
      expect(capturedTimeout).toBeDefined();
      expect(capturedTimeout!).toBeLessThan(200);
      expect(capturedTimeout!).toBeGreaterThan(100); // Should have ~150ms left
    });

    it('should timeout in delegation chain', async () => {
      // A delegates to B after 100ms
      const aMeta: LibrarianInfo = {
        id: 'a',
        name: 'A',
        description: 'Slow delegator',
        capabilities: [],
        team: 'test',
      };
      const aLibrarian = createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { delegate: { to: 'b' } };
      });
      router.register(aMeta, aLibrarian);

      // B takes another 100ms
      const bMeta: LibrarianInfo = {
        id: 'b',
        name: 'B',
        description: 'Also slow',
        capabilities: [],
        team: 'test',
      };
      const bLibrarian = createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { answer: 'Should timeout before this' };
      });
      router.register(bMeta, bLibrarian);

      const context: Context = { timeout: 150 }; // Not enough for both
      const response = await executor.execute('test', 'a', context);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('LIBRARIAN_TIMEOUT');
    });

    it('should check deadline before executing', async () => {
      // Chain of 3 librarians, each taking 60ms
      for (const id of ['x', 'y', 'z']) {
        const meta: LibrarianInfo = {
          id,
          name: id.toUpperCase(),
          description: 'Test',
          capabilities: [],
          team: 'test',
        };

        const nextId = { x: 'y', y: 'z', z: null }[id];
        const librarian = createLibrarian(async () => {
          await new Promise((resolve) => setTimeout(resolve, 60));
          if (nextId) {
            return { delegate: { to: nextId } };
          }
          return { answer: 'Final answer' };
        });

        router.register(meta, librarian);
      }

      const context: Context = { timeout: 100 }; // Not enough for all 3
      const response = await executor.execute('test', 'x', context);

      expect(response.error).toBeDefined();
      // Could be TIMEOUT_EXCEEDED or LIBRARIAN_TIMEOUT depending on timing
      expect(['TIMEOUT_EXCEEDED', 'LIBRARIAN_TIMEOUT']).toContain(response.error?.code);
    });
  });

  describe('timeout with parallel execution', () => {
    it('should handle timeout correctly when no timeout specified', async () => {
      const normalMeta: LibrarianInfo = {
        id: 'normal',
        name: 'Normal',
        description: 'No timeout',
        capabilities: [],
        team: 'test',
      };
      const normalLibrarian = createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { answer: 'Normal response' };
      });
      router.register(normalMeta, normalLibrarian);

      // No timeout in context
      const response = await executor.execute('test', 'normal', {});

      expect(response.answer).toBe('Normal response');
      expect(response.error).toBeUndefined();
    });

    it('should preserve delegation chain metadata on timeout', async () => {
      // A -> B -> timeout
      const aMeta: LibrarianInfo = {
        id: 'a',
        name: 'A',
        description: 'First',
        capabilities: [],
        team: 'test',
      };
      const aLibrarian = createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { delegate: { to: 'b' } };
      });
      router.register(aMeta, aLibrarian);

      const bMeta: LibrarianInfo = {
        id: 'b',
        name: 'B',
        description: 'Times out',
        capabilities: [],
        team: 'test',
      };
      const bLibrarian = createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { answer: 'Too late' };
      });
      router.register(bMeta, bLibrarian);

      const context: Context = { timeout: 80 };
      const response = await executor.execute('test', 'a', context);

      expect(response.error?.code).toBe('LIBRARIAN_TIMEOUT');
      expect(response.metadata?.delegationChain).toContain('a');
    });
  });
});

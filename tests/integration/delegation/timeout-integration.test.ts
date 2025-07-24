/**
 * Integration test for timeout management through DelegationEngine
 */

import { DelegationEngine } from '../../../src/delegation/engine';
import { SimpleRouter } from '../../../src/core/router';
import type { LibrarianInfo, Context } from '../../../src/types/core';
import { createLibrarian } from '../../../src/types/librarian-factory';

describe('Timeout integration with DelegationEngine', () => {
  let router: SimpleRouter;
  let engine: DelegationEngine;

  beforeEach(() => {
    router = new SimpleRouter();
    engine = new DelegationEngine(router);
  });

  it('should timeout single librarian through engine', async () => {
    const slowMeta: LibrarianInfo = {
      id: 'slow-lib',
      name: 'Slow Librarian',
      description: 'Takes too long',
      capabilities: ['slow'],
      team: 'test',
    };
    router.register(
      slowMeta,
      createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { answer: 'Too late' };
      }),
    );

    const context: Context = { timeout: 50 };
    const response = await engine.route('need slow help', context);

    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe('LIBRARIAN_TIMEOUT');
  });

  it('should propagate timeout through delegation chain', async () => {
    let secondLibrarianTimeout: number | undefined;

    // First librarian takes 50ms then delegates
    const firstMeta: LibrarianInfo = {
      id: 'first-router',
      name: 'First Router',
      description: 'Routes after delay',
      capabilities: ['routing'],
      team: 'test',
    };
    router.register(
      firstMeta,
      createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          delegate: {
            to: 'second-handler',
            context: { reason: 'Need specialized handling' },
          },
        };
      }),
    );

    // Second librarian captures the timeout
    const secondMeta: LibrarianInfo = {
      id: 'second-handler',
      name: 'Second Handler',
      description: 'Handles requests',
      capabilities: ['handling'],
      team: 'test',
    };
    router.register(
      secondMeta,
      createLibrarian(async (_query: string, context?: Context) => {
        secondLibrarianTimeout = context?.timeout;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { answer: 'Handled successfully' };
      }),
    );

    const context: Context = { timeout: 200 };
    const response = await engine.route('routing needed', context);

    expect(response.answer).toBe('Handled successfully');
    expect(response.metadata?.delegated).toBe(true);

    // Second librarian should have received reduced timeout
    expect(secondLibrarianTimeout).toBeDefined();
    expect(secondLibrarianTimeout!).toBeLessThan(200);
    expect(secondLibrarianTimeout!).toBeGreaterThan(100); // ~150ms remaining
  });

  it('should handle timeout in parallel routing', async () => {
    engine = new DelegationEngine(router, {
      enableParallelRouting: true,
      maxParallelQueries: 3,
    });

    // Mix of fast and slow librarians
    const librarians = [
      { id: 'fast1', delay: 20, answer: 'Fast 1' },
      { id: 'slow1', delay: 150, answer: 'Slow 1' },
      { id: 'fast2', delay: 30, answer: 'Fast 2' },
    ];

    for (const lib of librarians) {
      const meta: LibrarianInfo = {
        id: lib.id,
        name: lib.id,
        description: 'Test librarian',
        capabilities: ['test'],
        team: 'test',
      };

      router.register(
        meta,
        createLibrarian(async () => {
          await new Promise((resolve) => setTimeout(resolve, lib.delay));
          return { answer: lib.answer, confidence: 0.8 };
        }),
      );
    }

    const context: Context = { timeout: 100 };
    const response = await engine.route('test query', context);

    // Should get response from one of the fast librarians
    expect(response.answer).toBeDefined();
    expect(['Fast 1', 'Fast 2']).toContain(response.answer);

    // Should aggregate responses, excluding the slow one
    expect(response.metadata?.aggregation).toBeDefined();
    const aggMeta = response.metadata?.aggregation as any;
    expect(aggMeta.totalResponses).toBeLessThanOrEqual(3);
  });

  it('should handle cascading timeouts in delegation', async () => {
    // A -> B -> C, each taking 50ms
    const librarians = ['a', 'b', 'c'];

    for (let i = 0; i < librarians.length; i++) {
      const id = librarians[i];
      const nextId = librarians[i + 1];

      if (!id) continue;

      const meta: LibrarianInfo = {
        id,
        name: id.toUpperCase(),
        description: 'Chain librarian',
        capabilities: ['chain'],
        team: 'test',
      };

      router.register(
        meta,
        createLibrarian(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          if (nextId) {
            return { delegate: { to: nextId } };
          }
          return { answer: 'Final answer from C' };
        }),
      );
    }

    // 120ms timeout - enough for A and B, but not C
    const context: Context = { timeout: 120 };
    const response = await engine.route('chain query', context);

    expect(response.error).toBeDefined();
    expect(['TIMEOUT_EXCEEDED', 'LIBRARIAN_TIMEOUT']).toContain(response.error?.code);

    // Should have made it through at least A
    expect(response.metadata?.delegationChain).toBeDefined();
    expect(response.metadata?.delegationChain).toContain('a');
  });

  it('should not apply timeout when not specified', async () => {
    const slowMeta: LibrarianInfo = {
      id: 'slow-ok',
      name: 'Slow but OK',
      description: 'Takes time but no timeout',
      capabilities: ['slow'],
      team: 'test',
    };
    router.register(
      slowMeta,
      createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { answer: 'Slow but successful' };
      }),
    );

    // No timeout in context
    const response = await engine.route('slow is ok', {});

    expect(response.answer).toBe('Slow but successful');
    expect(response.error).toBeUndefined();
  });
});

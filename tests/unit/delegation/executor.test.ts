/**
 * Tests for delegation executor - handles librarian delegation responses
 */

import { DelegationExecutor } from '../../../src/delegation/executor';
import { SimpleRouter } from '../../../src/core/router';
import type { Context, LibrarianInfo } from '../../../src/types/core';
import { createLibrarian } from '../../../src/types/librarian-factory';

describe('DelegationExecutor', () => {
  let router: SimpleRouter;
  let executor: DelegationExecutor;

  beforeEach(() => {
    router = new SimpleRouter();
    executor = new DelegationExecutor(router);
  });

  describe('simple delegation', () => {
    it('should execute delegation when librarian returns delegate response', async () => {
      // Register a librarian that delegates
      const delegatorMetadata: LibrarianInfo = {
        id: 'delegator',
        name: 'Delegating Librarian',
        description: 'Delegates to experts',
        capabilities: ['general'],
        team: 'test',
      };
      const delegatingLibrarian = createLibrarian((query: string) =>
        Promise.resolve({
          delegate: {
            to: 'expert',
            query: `Please handle: ${query}`,
          },
        }),
      );
      router.register(delegatorMetadata, delegatingLibrarian);

      // Register the expert librarian
      const expertMetadata: LibrarianInfo = {
        id: 'expert',
        name: 'Expert Librarian',
        description: 'Handles delegated queries',
        capabilities: ['expertise'],
        team: 'test',
      };
      const expertLibrarian = createLibrarian((query: string) =>
        Promise.resolve({
          answer: `Expert response to: ${query}`,
          confidence: 0.9,
        }),
      );
      router.register(expertMetadata, expertLibrarian);

      // Execute query that will be delegated
      const response = await executor.execute('test query', 'delegator', {});

      // Should get response from expert, not delegator
      expect(response.answer).toBe('Expert response to: Please handle: test query');
      expect(response.confidence).toBe(0.9);
      expect(response.metadata?.delegated).toBe(true);
      expect(response.metadata?.delegationChain).toEqual(['delegator', 'expert']);
    });

    it('should handle missing delegation target', async () => {
      // Register librarian that delegates to non-existent target
      const metadata: LibrarianInfo = {
        id: 'delegator',
        name: 'Delegator',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const delegatingLibrarian = createLibrarian(() =>
        Promise.resolve({
          delegate: {
            to: 'non-existent',
          },
        }),
      );
      router.register(metadata, delegatingLibrarian);

      const response = await executor.execute('test query', 'delegator', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('DELEGATION_TARGET_NOT_FOUND');
      expect(response.error?.message).toContain('non-existent');
    });

    it('should pass context through delegation chain', async () => {
      const context: Context = {
        user: { id: 'user123', teams: ['eng'] },
        ai: {} as any,
        metadata: { source: 'test' },
      };

      let capturedContext: Context | undefined;

      const delegatorMeta: LibrarianInfo = {
        id: 'delegator',
        name: 'Delegator',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const delegatingLibrarian = createLibrarian(() =>
        Promise.resolve({
          delegate: { to: 'expert' },
        }),
      );
      router.register(delegatorMeta, delegatingLibrarian);

      const expertMeta: LibrarianInfo = {
        id: 'expert',
        name: 'Expert',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const expertLibrarian = createLibrarian((_query: string, ctx?: Context) => {
        capturedContext = ctx;
        return Promise.resolve({ answer: 'Done' });
      });
      router.register(expertMeta, expertLibrarian);

      await executor.execute('test', 'delegator', context);

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.user?.id).toBe('user123');
      expect(capturedContext?.metadata?.source).toBe('test');
      // The delegation chain should show the path to this librarian
      const chain = (capturedContext as any)?.delegationChain;
      expect(chain).toBeDefined();
      expect(chain).toContain('delegator');
    });
  });

  describe('delegation loops', () => {
    it('should prevent simple delegation loops', async () => {
      // A delegates to B, B delegates back to A
      const metaA: LibrarianInfo = {
        id: 'a',
        name: 'A',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const librarianA = createLibrarian(() => Promise.resolve({ delegate: { to: 'b' } }));

      const metaB: LibrarianInfo = {
        id: 'b',
        name: 'B',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const librarianB = createLibrarian(() => Promise.resolve({ delegate: { to: 'a' } }));

      router.register(metaA, librarianA);
      router.register(metaB, librarianB);

      const response = await executor.execute('test', 'a', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('DELEGATION_LOOP_DETECTED');
      expect(response.error?.message).toContain('loop');
    });

    it('should enforce maximum delegation depth', async () => {
      // Create a chain of 10 librarians
      for (let i = 0; i < 10; i++) {
        const meta: LibrarianInfo = {
          id: `lib${i}`,
          name: `Lib ${i}`,
          description: 'Test',
          capabilities: [],
          team: 'test',
        };
        const librarian = createLibrarian(() =>
          Promise.resolve({
            delegate: { to: `lib${i + 1}` },
          }),
        );
        router.register(meta, librarian);
      }

      // Final librarian returns answer
      const finalMeta: LibrarianInfo = {
        id: 'lib10',
        name: 'Final',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      router.register(
        finalMeta,
        createLibrarian(() => Promise.resolve({ answer: 'Final answer' })),
      );

      const response = await executor.execute('test', 'lib0', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('MAX_DELEGATION_DEPTH_EXCEEDED');
    });
  });

  describe('delegation with modified queries', () => {
    it('should use delegated query when provided', async () => {
      let receivedQuery: string | undefined;

      const delegatorMeta: LibrarianInfo = {
        id: 'delegator',
        name: 'Delegator',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const delegator = createLibrarian(() =>
        Promise.resolve({
          delegate: {
            to: 'expert',
            query: 'refined query for expert',
          },
        }),
      );
      router.register(delegatorMeta, delegator);

      const expertMeta: LibrarianInfo = {
        id: 'expert',
        name: 'Expert',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const expert = createLibrarian((query: string) => {
        receivedQuery = query;
        return Promise.resolve({ answer: 'Done' });
      });
      router.register(expertMeta, expert);

      await executor.execute('original query', 'delegator', {});

      expect(receivedQuery).toBe('refined query for expert');
    });

    it('should preserve original query in context', async () => {
      let contextInExpert: Context | undefined;

      const delegatorMeta: LibrarianInfo = {
        id: 'delegator',
        name: 'Delegator',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const delegator = createLibrarian(() =>
        Promise.resolve({
          delegate: {
            to: 'expert',
            query: 'modified query',
          },
        }),
      );
      router.register(delegatorMeta, delegator);

      const expertMeta: LibrarianInfo = {
        id: 'expert',
        name: 'Expert',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const expert = createLibrarian((_query: string, ctx?: Context) => {
        contextInExpert = ctx;
        return Promise.resolve({ answer: 'Done' });
      });
      router.register(expertMeta, expert);

      await executor.execute('original query', 'delegator', {});

      expect((contextInExpert as any)?.originalQuery).toBe('original query');
    });
  });

  describe('delegation metadata', () => {
    it('should include delegation reason when provided', async () => {
      const delegatorMeta: LibrarianInfo = {
        id: 'delegator',
        name: 'Delegator',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const delegator = createLibrarian(() =>
        Promise.resolve({
          delegate: {
            to: 'expert',
            context: {
              reason: 'Query requires domain expertise',
            },
          },
        }),
      );
      router.register(delegatorMeta, delegator);

      const expertMeta: LibrarianInfo = {
        id: 'expert',
        name: 'Expert',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const expert = createLibrarian(() => Promise.resolve({ answer: 'Expert answer' }));
      router.register(expertMeta, expert);

      const response = await executor.execute('test', 'delegator', {});

      expect(response.metadata?.delegationReason).toBe('Query requires domain expertise');
    });

    it('should track delegation timing', async () => {
      const delegatorMeta: LibrarianInfo = {
        id: 'delegator',
        name: 'Delegator',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const delegator = createLibrarian(async () => {
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 50));
        return Promise.resolve({ delegate: { to: 'expert' } });
      });
      router.register(delegatorMeta, delegator);

      const expertMeta: LibrarianInfo = {
        id: 'expert',
        name: 'Expert',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const expert = createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return Promise.resolve({ answer: 'Done' });
      });
      router.register(expertMeta, expert);

      const startTime = Date.now();
      const response = await executor.execute('test', 'delegator', {});
      const totalTime = Date.now() - startTime;

      expect(response.metadata?.executionTime).toBeDefined();
      expect(response.metadata?.executionTime).toBeLessThanOrEqual(totalTime);
      expect(response.metadata?.executionTime).toBeGreaterThanOrEqual(100); // At least 100ms
    });
  });

  describe('error handling', () => {
    it('should handle errors in delegated librarian', async () => {
      const delegatorMeta: LibrarianInfo = {
        id: 'delegator',
        name: 'Delegator',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const delegator = createLibrarian(() => Promise.resolve({ delegate: { to: 'faulty' } }));
      router.register(delegatorMeta, delegator);

      const faultyMeta: LibrarianInfo = {
        id: 'faulty',
        name: 'Faulty',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const faulty = createLibrarian(() => {
        throw new Error('Expert failed');
      });
      router.register(faultyMeta, faulty);

      const response = await executor.execute('test', 'delegator', {});

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Expert failed');
      expect(response.metadata?.delegationChain).toEqual(['delegator', 'faulty']);
    });

    it('should not execute delegation if initial librarian fails', async () => {
      let expertCalled = false;

      const delegatorMeta: LibrarianInfo = {
        id: 'delegator',
        name: 'Delegator',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const delegator = createLibrarian(() => {
        throw new Error('Delegator failed');
      });
      router.register(delegatorMeta, delegator);

      const expertMeta: LibrarianInfo = {
        id: 'expert',
        name: 'Expert',
        description: 'Test',
        capabilities: [],
        team: 'test',
      };
      const expert = createLibrarian(() => {
        expertCalled = true;
        return Promise.resolve({ answer: 'Should not be called' });
      });
      router.register(expertMeta, expert);

      const response = await executor.execute('test', 'delegator', {});

      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Delegator failed');
      expect(expertCalled).toBe(false);
    });
  });
});

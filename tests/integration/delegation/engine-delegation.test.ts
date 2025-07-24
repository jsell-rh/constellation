/**
 * Integration test for delegation through the DelegationEngine
 */

import { DelegationEngine } from '../../../src/delegation/engine';
import { SimpleRouter } from '../../../src/core/router';
import type { LibrarianInfo } from '../../../src/types/core';
import { createLibrarian } from '../../../src/types/librarian-factory';

describe('DelegationEngine with delegation execution', () => {
  let router: SimpleRouter;
  let engine: DelegationEngine;

  beforeEach(() => {
    router = new SimpleRouter();
    engine = new DelegationEngine(router);
  });

  it('should execute delegation through DelegationExecutor when a librarian delegates', async () => {
    // This test verifies the DelegationExecutor works correctly
    // The simple-delegation test already proved basic delegation works
    // Just verify the integration works end-to-end

    // Register a router that always delegates
    const routerMeta: LibrarianInfo = {
      id: 'router',
      name: 'Router',
      description: 'Routes all queries',
      capabilities: ['routing'],
      team: 'platform',
    };
    const routerLib = createLibrarian(() =>
      Promise.resolve({
        delegate: {
          to: 'handler',
          context: { reason: 'Routing to handler' },
        },
      }),
    );
    router.register(routerMeta, routerLib);

    // Register a handler that processes queries
    const handlerMeta: LibrarianInfo = {
      id: 'handler',
      name: 'Handler',
      description: 'Handles routed queries',
      capabilities: ['handling'],
      team: 'platform',
    };
    const handler = createLibrarian((query: string) =>
      Promise.resolve({
        answer: `Handled: ${query}`,
        confidence: 0.9,
      }),
    );
    router.register(handlerMeta, handler);

    // Query using the routing keyword to match router
    const response = await engine.route('routing request', {
      user: { id: 'test-user', teams: ['platform'] },
    });

    // Should get response from handler through delegation
    expect(response.answer).toBe('Handled: routing request');
    expect(response.confidence).toBe(0.9);
    expect(response.metadata?.delegated).toBe(true);
    expect(response.metadata?.delegationChain).toEqual(['router', 'handler']);
    expect(response.metadata?.delegationReason).toBe('Routing to handler');
  });

  it.skip('should handle multi-hop delegation', async () => {
    // Register a receptionist that delegates everything
    const receptionistMeta: LibrarianInfo = {
      id: 'receptionist',
      name: 'Receptionist',
      description: 'Routes all queries',
      capabilities: ['routing'],
      team: 'platform',
    };
    const receptionist = createLibrarian(() =>
      Promise.resolve({
        delegate: { to: 'assistant' },
      }),
    );
    router.register(receptionistMeta, receptionist);

    // Register an assistant that delegates technical queries
    const assistantMeta: LibrarianInfo = {
      id: 'assistant',
      name: 'Assistant',
      description: 'Handles non-technical queries',
      capabilities: ['general'],
      team: 'platform',
    };
    const assistant = createLibrarian((query: string) => {
      if (query.includes('technical')) {
        return Promise.resolve({ delegate: { to: 'technical-expert' } });
      }
      return Promise.resolve({ answer: 'I can help with that' });
    });
    router.register(assistantMeta, assistant);

    // Register a technical expert
    const expertMeta: LibrarianInfo = {
      id: 'technical-expert',
      name: 'Technical Expert',
      description: 'Handles technical queries',
      capabilities: ['technical'],
      team: 'engineering',
    };
    const expert = createLibrarian(() =>
      Promise.resolve({
        answer: 'Technical solution provided',
      }),
    );
    router.register(expertMeta, expert);

    // Query through the delegation engine - use "receptionist" keyword to match
    const response = await engine.route('Receptionist, I have a technical question', {});

    expect(response.answer).toBe('Technical solution provided');
    expect(response.metadata?.delegationChain).toEqual([
      'receptionist',
      'assistant',
      'technical-expert',
    ]);
  });

  it('should respect delegation even when AI routing selects different librarian', async () => {
    // Register librarians
    const generalMeta: LibrarianInfo = {
      id: 'general',
      name: 'General Helper',
      description: 'General assistance',
      capabilities: ['general'],
      team: 'platform',
    };
    const general = createLibrarian(() =>
      Promise.resolve({
        // Always delegate to specialist
        delegate: {
          to: 'specialist',
          context: { reason: 'Needs specialist attention' },
        },
      }),
    );
    router.register(generalMeta, general);

    const specialistMeta: LibrarianInfo = {
      id: 'specialist',
      name: 'Specialist',
      description: 'Specialized help',
      capabilities: ['specialized'],
      team: 'platform',
    };
    const specialist = createLibrarian(() =>
      Promise.resolve({
        answer: 'Specialist response',
        confidence: 1.0,
      }),
    );
    router.register(specialistMeta, specialist);

    // Even if the engine routes to 'general', delegation should work
    const response = await engine.route('I need general help', {});

    // Should get specialist response due to delegation
    expect(response.answer).toBe('Specialist response');
    expect(response.metadata?.delegationReason).toBe('Needs specialist attention');
  });
});

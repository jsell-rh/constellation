/**
 * Simple test to verify delegation works end-to-end
 */

import { DelegationEngine } from '../../../src/delegation/engine';
import { SimpleRouter } from '../../../src/core/router';
import type { LibrarianInfo } from '../../../src/types/core';
import { createLibrarian } from '../../../src/types/librarian-factory';

describe('Simple Delegation Test', () => {
  it('should delegate from one librarian to another', async () => {
    const router = new SimpleRouter();
    const engine = new DelegationEngine(router);

    // Register a simple delegator
    const delegatorMeta: LibrarianInfo = {
      id: 'simple-delegator',
      name: 'Simple Delegator',
      description: 'Always delegates',
      capabilities: ['routing'],
      team: 'test',
    };
    router.register(
      delegatorMeta,
      createLibrarian(() =>
        Promise.resolve({
          delegate: { to: 'simple-expert' },
        }),
      ),
    );

    // Register a simple expert
    const expertMeta: LibrarianInfo = {
      id: 'simple-expert',
      name: 'Simple Expert',
      description: 'Handles delegated queries',
      capabilities: ['expertise'],
      team: 'test',
    };
    router.register(
      expertMeta,
      createLibrarian(() =>
        Promise.resolve({
          answer: 'Expert response',
          confidence: 1.0,
        }),
      ),
    );

    // Query using keywords that match the delegator
    const response = await engine.route('I need the simple delegator', {});

    // Verify we got the expert's response
    expect(response.answer).toBe('Expert response');
    expect(response.confidence).toBe(1.0);
    expect(response.metadata?.delegated).toBe(true);
    expect(response.metadata?.delegationChain).toEqual(['simple-delegator', 'simple-expert']);
  });
});

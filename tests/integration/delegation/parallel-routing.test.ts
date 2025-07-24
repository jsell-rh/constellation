/**
 * Integration test for parallel routing and response aggregation
 */

import { DelegationEngine } from '../../../src/delegation/engine';
import { SimpleRouter } from '../../../src/core/router';
import type { LibrarianInfo } from '../../../src/types/core';
import { createLibrarian } from '../../../src/types/librarian-factory';

describe('Parallel routing and aggregation', () => {
  let router: SimpleRouter;
  let engine: DelegationEngine;

  beforeEach(() => {
    router = new SimpleRouter();
  });

  it('should query multiple librarians in parallel when enabled', async () => {
    // Create engine with parallel routing enabled
    engine = new DelegationEngine(router, {
      enableParallelRouting: true,
      maxParallelQueries: 3,
    });

    const queryTimes: Record<string, number> = {};

    // Register multiple experts that track when they're called
    const experts = [
      { id: 'expert1', name: 'Expert One', confidence: 0.7 },
      { id: 'expert2', name: 'Expert Two', confidence: 0.9 },
      { id: 'expert3', name: 'Expert Three', confidence: 0.8 },
    ];

    for (const expert of experts) {
      const metadata: LibrarianInfo = {
        id: expert.id,
        name: expert.name,
        description: 'Domain expert',
        capabilities: ['expertise'],
        team: 'test',
      };

      const librarian = createLibrarian(async () => {
        queryTimes[expert.id] = Date.now();
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          answer: `Answer from ${expert.name}`,
          confidence: expert.confidence,
        };
      });

      router.register(metadata, librarian);
    }

    // Query with keywords that match all experts
    const response = await engine.route('I need expertise from domain experts', {});

    // Verify we got the best confidence answer
    expect(response.answer).toBe('Answer from Expert Two');
    expect(response.confidence).toBe(0.9);

    // Verify parallel execution (all should start within a small window)
    const times = Object.values(queryTimes);
    expect(times).toHaveLength(3);

    const maxTimeDiff = Math.max(...times) - Math.min(...times);
    expect(maxTimeDiff).toBeLessThan(20); // Should all start within 20ms

    // Check aggregation metadata
    expect(response.metadata?.aggregation).toBeDefined();
    const delegation = response.metadata?.delegation as any;
    expect(delegation?.parallelRouting).toBe(true);
    expect(delegation?.queriedLibrarians).toHaveLength(3);
  });

  it('should respect maxParallelQueries limit', async () => {
    engine = new DelegationEngine(router, {
      enableParallelRouting: true,
      maxParallelQueries: 2,
    });

    // Register 5 experts
    for (let i = 1; i <= 5; i++) {
      const metadata: LibrarianInfo = {
        id: `expert${i}`,
        name: `Expert ${i}`,
        description: 'Domain expert',
        capabilities: ['expertise'],
        team: 'test',
      };

      const librarian = createLibrarian(() =>
        Promise.resolve({
          answer: `Answer from Expert ${i}`,
          confidence: i * 0.2, // 0.2, 0.4, 0.6, 0.8, 1.0
        }),
      );

      router.register(metadata, librarian);
    }

    const response = await engine.route('expertise needed', {});

    // Should only query the first 2 matches based on maxParallelQueries
    const delegation = response.metadata?.delegation as any;
    expect(delegation?.queriedLibrarians).toHaveLength(2);
  });

  it('should fallback to single routing when parallel routing disabled', async () => {
    engine = new DelegationEngine(router, {
      enableParallelRouting: false,
    });

    let callCount = 0;

    // Register multiple experts
    for (let i = 1; i <= 3; i++) {
      const metadata: LibrarianInfo = {
        id: `expert${i}`,
        name: `Expert ${i}`,
        description: 'Domain expert',
        capabilities: ['expertise'],
        team: 'test',
      };

      const librarian = createLibrarian(() => {
        callCount++;
        return Promise.resolve({
          answer: `Answer from Expert ${i}`,
          confidence: 0.8,
        });
      });

      router.register(metadata, librarian);
    }

    const response = await engine.route('expertise needed', {});

    // Should only call one librarian
    expect(callCount).toBe(1);
    const delegation = response.metadata?.delegation as any;
    expect(delegation?.parallelRouting).toBeFalsy();
    expect(delegation?.queriedLibrarians).toHaveLength(1);
  });

  it('should handle mixed success and failure responses', async () => {
    engine = new DelegationEngine(router, {
      enableParallelRouting: true,
      maxParallelQueries: 3,
    });

    // Register experts with different behaviors
    const successMeta: LibrarianInfo = {
      id: 'success-expert',
      name: 'Success Expert',
      description: 'Always succeeds',
      capabilities: ['expertise'],
      team: 'test',
    };
    router.register(
      successMeta,
      createLibrarian(() =>
        Promise.resolve({
          answer: 'Successful answer',
          confidence: 0.8,
        }),
      ),
    );

    const failMeta: LibrarianInfo = {
      id: 'fail-expert',
      name: 'Fail Expert',
      description: 'Always fails',
      capabilities: ['expertise'],
      team: 'test',
    };
    router.register(
      failMeta,
      createLibrarian(() => Promise.reject(new Error('Expert failed'))),
    );

    const slowMeta: LibrarianInfo = {
      id: 'slow-expert',
      name: 'Slow Expert',
      description: 'Very slow',
      capabilities: ['expertise'],
      team: 'test',
    };
    router.register(
      slowMeta,
      createLibrarian(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          answer: 'Slow but good answer',
          confidence: 0.9,
        };
      }),
    );

    const response = await engine.route('expertise needed', {});

    // Should aggregate successful responses despite one failure
    expect(response.error).toBeUndefined();
    expect(response.answer).toBeDefined();

    // Should pick the highest confidence answer (slow-expert)
    expect(response.answer).toBe('Slow but good answer');
    expect(response.confidence).toBe(0.9);
  });

  it('should aggregate sources from multiple librarians', async () => {
    engine = new DelegationEngine(router, {
      enableParallelRouting: true,
      maxParallelQueries: 2,
    });

    const expert1Meta: LibrarianInfo = {
      id: 'expert1',
      name: 'Expert One',
      description: 'First expert',
      capabilities: ['expertise'],
      team: 'test',
    };
    router.register(
      expert1Meta,
      createLibrarian(() =>
        Promise.resolve({
          answer: 'Answer 1',
          confidence: 0.7,
          sources: [
            { name: 'Doc A', url: 'http://a.com' },
            { name: 'Doc B', url: 'http://b.com' },
          ],
        }),
      ),
    );

    const expert2Meta: LibrarianInfo = {
      id: 'expert2',
      name: 'Expert Two',
      description: 'Second expert',
      capabilities: ['expertise'],
      team: 'test',
    };
    router.register(
      expert2Meta,
      createLibrarian(() =>
        Promise.resolve({
          answer: 'Answer 2',
          confidence: 0.8,
          sources: [
            { name: 'Doc B', url: 'http://b.com' }, // Duplicate
            { name: 'Doc C', url: 'http://c.com' },
          ],
        }),
      ),
    );

    const response = await engine.route('expertise needed', {});

    // Should get answer from expert2 (higher confidence)
    expect(response.answer).toBe('Answer 2');

    // Should have merged sources (3 unique)
    expect(response.sources).toHaveLength(3);
    const urls = response.sources?.map((s) => s.url);
    expect(urls).toContain('http://a.com');
    expect(urls).toContain('http://b.com');
    expect(urls).toContain('http://c.com');
  });
});

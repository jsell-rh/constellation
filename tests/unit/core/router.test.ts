/* eslint-disable @typescript-eslint/require-await */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleRouter } from '../../../src/core/router';
import { createLibrarian } from '../../../src/types/librarian-factory';
import type { Context, LibrarianInfo } from '../../../src/types/core';

describe('SimpleRouter', () => {
  let router: SimpleRouter;

  beforeEach(() => {
    router = new SimpleRouter();
  });

  describe('register', () => {
    it('should register a librarian with metadata', () => {
      const librarian = createLibrarian(async () => {
        return { answer: 'test' };
      });

      const metadata: LibrarianInfo = {
        id: 'test-lib',
        name: 'Test Librarian',
        description: 'A test librarian',
        capabilities: ['test.capability'],
      };

      router.register(metadata, librarian);
      
      expect(router.getLibrarian('test-lib')).toBe(librarian);
      expect(router.getMetadata('test-lib')).toEqual(metadata);
    });

    it('should throw error when registering duplicate ID', () => {
      const librarian = createLibrarian(async () => {
        return { answer: 'test' };
      });

      const metadata: LibrarianInfo = {
        id: 'duplicate',
        name: 'Test',
        description: 'Test',
        capabilities: [],
      };

      router.register(metadata, librarian);
      
      expect(() => {
        router.register(metadata, librarian);
      }).toThrow('already registered');
    });

    it('should validate metadata has required fields', () => {
      const librarian = createLibrarian(async () => {
        return { answer: 'test' };
      });

      const invalidMetadata = {
        id: 'test',
        // Missing required fields
      } as LibrarianInfo;

      expect(() => {
        router.register(invalidMetadata, librarian);
      }).toThrow('Invalid metadata');
    });
  });

  describe('route', () => {
    it('should route to registered librarian', async () => {
      const librarian = createLibrarian(async (query: string) => {
        return { answer: `Echo: ${query}` };
      });

      const metadata: LibrarianInfo = {
        id: 'echo',
        name: 'Echo',
        description: 'Echoes input',
        capabilities: ['echo'],
      };

      router.register(metadata, librarian);
      
      const response = await router.route('test query', 'echo');
      expect(response.answer).toBe('Echo: test query');
    });

    it('should include librarian metadata in context', async () => {
      let capturedContext: Context | undefined;
      const librarian = createLibrarian(async (_query: string, context?: Context) => {
        capturedContext = context;
        return { answer: 'test' };
      });

      const metadata: LibrarianInfo = {
        id: 'context-test',
        name: 'Context Test',
        description: 'Tests context',
        capabilities: ['test'],
      };

      router.register(metadata, librarian);
      
      await router.route('test', 'context-test');
      
      expect(capturedContext?.librarian).toEqual(metadata);
    });

    it('should return error for unknown librarian', async () => {
      const response = await router.route('test', 'unknown-lib');
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('LIBRARIAN_NOT_FOUND');
      expect(response.error?.librarian).toBe('unknown-lib');
    });

    it('should pass through provided context', async () => {
      let capturedContext: Context | undefined;
      const librarian = createLibrarian(async (_query: string, context?: Context) => {
        capturedContext = context;
        return { answer: 'test' };
      });

      const metadata: LibrarianInfo = {
        id: 'context-pass',
        name: 'Context Pass',
        description: 'Passes context',
        capabilities: ['test'],
      };

      router.register(metadata, librarian);
      
      const inputContext: Context = {
        user: { id: 'user123' },
        trace: {
          traceId: 'trace123',
          spanId: 'span456',
          startTime: Date.now(),
        },
      };
      
      await router.route('test', 'context-pass', inputContext);
      
      expect(capturedContext?.user?.id).toBe('user123');
      expect(capturedContext?.trace?.traceId).toBe('trace123');
      expect(capturedContext?.librarian?.id).toBe('context-pass');
    });

    it('should use executor for routing', async () => {
      const librarian = createLibrarian(async () => {
        return { answer: 'test', metadata: { fromLibrarian: true } };
      });

      const metadata: LibrarianInfo = {
        id: 'executor-test',
        name: 'Executor Test',
        description: 'Tests executor',
        capabilities: ['test'],
      };

      router.register(metadata, librarian);
      
      const response = await router.route('test', 'executor-test');
      
      // Executor adds execution time
      expect(response.metadata?.executionTimeMs).toBeDefined();
      expect(response.metadata?.fromLibrarian).toBe(true);
    });
  });

  describe('getLibrarian', () => {
    it('should return registered librarian', () => {
      const librarian = createLibrarian(async () => {
        return { answer: 'test' };
      });

      const metadata: LibrarianInfo = {
        id: 'get-test',
        name: 'Get Test',
        description: 'Tests get',
        capabilities: ['test'],
      };

      router.register(metadata, librarian);
      
      expect(router.getLibrarian('get-test')).toBe(librarian);
    });

    it('should return undefined for unknown librarian', () => {
      expect(router.getLibrarian('unknown')).toBeUndefined();
    });
  });

  describe('getMetadata', () => {
    it('should return librarian metadata', () => {
      const librarian = createLibrarian(async () => {
        return { answer: 'test' };
      });

      const metadata: LibrarianInfo = {
        id: 'meta-test',
        name: 'Meta Test',
        description: 'Tests metadata',
        capabilities: ['test'],
      };

      router.register(metadata, librarian);
      
      expect(router.getMetadata('meta-test')).toEqual(metadata);
    });

    it('should return undefined for unknown librarian', () => {
      expect(router.getMetadata('unknown')).toBeUndefined();
    });
  });

  describe('getAllLibrarians', () => {
    it('should return all registered librarian IDs', () => {
      const lib1 = createLibrarian(async () => ({ answer: 'test1' }));
      const lib2 = createLibrarian(async () => ({ answer: 'test2' }));

      router.register({
        id: 'lib1',
        name: 'Lib 1',
        description: 'First lib',
        capabilities: ['test'],
      }, lib1);

      router.register({
        id: 'lib2',
        name: 'Lib 2',
        description: 'Second lib',
        capabilities: ['test'],
      }, lib2);

      const ids = router.getAllLibrarians();
      expect(ids).toContain('lib1');
      expect(ids).toContain('lib2');
      expect(ids).toHaveLength(2);
    });

    it('should return empty array when no librarians registered', () => {
      expect(router.getAllLibrarians()).toEqual([]);
    });
  });

  describe('findByCapability', () => {
    it('should find librarians by exact capability match', () => {
      const lib1 = createLibrarian(async () => ({ answer: 'test1' }));
      const lib2 = createLibrarian(async () => ({ answer: 'test2' }));

      router.register({
        id: 'kubernetes-expert',
        name: 'K8s Expert',
        description: 'Kubernetes specialist',
        capabilities: ['kubernetes.deployment', 'kubernetes.service'],
      }, lib1);

      router.register({
        id: 'docker-expert',
        name: 'Docker Expert',
        description: 'Docker specialist',
        capabilities: ['docker.container', 'docker.image'],
      }, lib2);

      const k8sLibs = router.findByCapability('kubernetes.deployment');
      expect(k8sLibs).toHaveLength(1);
      expect(k8sLibs[0]?.id).toBe('kubernetes-expert');
    });

    it('should find librarians by partial capability match', () => {
      const lib1 = createLibrarian(async () => ({ answer: 'test1' }));
      const lib2 = createLibrarian(async () => ({ answer: 'test2' }));

      router.register({
        id: 'k8s-ops',
        name: 'K8s Ops',
        description: 'K8s operations',
        capabilities: ['kubernetes.operations.deployment'],
      }, lib1);

      router.register({
        id: 'k8s-troubleshoot',
        name: 'K8s Troubleshoot',
        description: 'K8s troubleshooting',
        capabilities: ['kubernetes.troubleshooting.pods'],
      }, lib2);

      const k8sLibs = router.findByCapability('kubernetes');
      expect(k8sLibs).toHaveLength(2);
    });

    it('should return empty array when no matches', () => {
      const lib = createLibrarian(async () => ({ answer: 'test' }));

      router.register({
        id: 'test',
        name: 'Test',
        description: 'Test',
        capabilities: ['something.else'],
      }, lib);

      expect(router.findByCapability('kubernetes')).toEqual([]);
    });
  });
});
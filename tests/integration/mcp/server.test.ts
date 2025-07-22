/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConstellationMCPServer } from '../../../src/mcp/server';
import { SimpleRouter } from '../../../src/core/router';
import { createLibrarian } from '../../../src/types/librarian-factory';
import type { Response } from '../../../src/types/core';

describe('MCP Server', () => {
  let server: ConstellationMCPServer;
  let router: SimpleRouter;

  beforeEach(async () => {
    router = new SimpleRouter();
    
    // Register test librarians
    const echoLibrarian = createLibrarian((query: string) => {
      return Promise.resolve({ answer: `Echo: ${query}`, confidence: 0.9 });
    });

    const kubernetesLibrarian = createLibrarian((query: string) => {
      if (query.toLowerCase().includes('deploy')) {
        return Promise.resolve({
          answer: 'To deploy to Kubernetes, use: kubectl apply -f deployment.yaml',
          confidence: 0.95,
          sources: [{ name: 'K8s Deployment Guide', url: 'https://docs.k8s.io' }],
        });
      }
      return Promise.resolve({ answer: 'Please ask about Kubernetes deployments', confidence: 0.3 });
    });

    const errorLibrarian = createLibrarian(() => {
      return Promise.resolve({
        error: {
          code: 'TEST_ERROR',
          message: 'This is a test error',
        },
      });
    });

    router.register({
      id: 'echo',
      name: 'Echo Librarian',
      description: 'Echoes the input query',
      capabilities: ['echo', 'test'],
    }, echoLibrarian);

    router.register({
      id: 'kubernetes',
      name: 'Kubernetes Expert',
      description: 'Helps with Kubernetes operations and troubleshooting',
      capabilities: ['kubernetes.deployment', 'kubernetes.service', 'kubernetes.pod'],
      team: 'platform',
    }, kubernetesLibrarian);

    router.register({
      id: 'error-test',
      name: 'Error Test Librarian',
      description: 'Always returns an error',
      capabilities: ['error', 'test'],
    }, errorLibrarian);

    server = new ConstellationMCPServer(router);
  });

  describe('Tool Discovery', () => {
    it('should expose query and query_librarian tools', () => {
      // Access private method via any cast for testing
      const tools = (server as any).getTools();
      
      expect(tools).toHaveLength(2);
      
      const queryTool = tools.find((t: any) => t.name === 'query');
      expect(queryTool).toBeDefined();
      expect(queryTool?.description).toContain('AI delegation engine');
      expect(queryTool?.inputSchema.required).toContain('query');
      
      const queryLibrarianTool = tools.find((t: any) => t.name === 'query_librarian');
      expect(queryLibrarianTool).toBeDefined();
      expect(queryLibrarianTool?.description).toContain('specific librarian');
      expect(queryLibrarianTool?.inputSchema.required).toContain('librarian_id');
      expect(queryLibrarianTool?.inputSchema.required).toContain('query');
    });
  });

  describe('Query Tool', () => {
    it('should route queries through delegation engine', async () => {
      const result = await (server as any).executeTool('query', {
        query: 'How do I deploy to Kubernetes?',
      });
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toContain('kubectl apply');
    });

    it('should handle queries with context', async () => {
      const result = await (server as any).executeTool('query', {
        query: 'echo this message',
        context: {
          user_id: 'test-user',
          metadata: { source: 'test' },
        },
      });
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.text).toContain('Echo: echo this message');
    });

    it('should return error for queries with no matches', async () => {
      const result = await (server as any).executeTool('query', {
        query: 'completely unrelated query about nothing',
      });
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.text).toContain('Error:');
    });

    it('should validate required arguments', async () => {
      const result = await (server as any).executeTool('query', {});
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.text).toContain('Missing required argument: query');
    });
  });

  describe('Query Librarian Tool', () => {
    it('should route directly to specified librarian', async () => {
      const result = await (server as any).executeTool('query_librarian', {
        librarian_id: 'echo',
        query: 'Hello MCP',
      });
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.text).toContain('Echo: Hello MCP');
    });

    it('should handle unknown librarian', async () => {
      const result = await (server as any).executeTool('query_librarian', {
        librarian_id: 'unknown',
        query: 'test',
      });
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.text).toContain('Error: LIBRARIAN_NOT_FOUND');
    });

    it('should validate required arguments', async () => {
      let result = await (server as any).executeTool('query_librarian', {
        query: 'test',
      });
      
      expect(result.content[0]?.text).toContain('Missing required argument: librarian_id');

      result = await (server as any).executeTool('query_librarian', {
        librarian_id: 'echo',
      });
      
      expect(result.content[0]?.text).toContain('Missing required argument: query');
    });
  });

  describe('Resource Discovery', () => {
    it('should expose librarian hierarchy resource', () => {
      const resources = (server as any).getResources();
      
      expect(resources).toHaveLength(1);
      expect(resources[0]?.uri).toBe('constellation://librarian-hierarchy');
      expect(resources[0]?.name).toBe('Librarian Hierarchy');
      expect(resources[0]?.mimeType).toBe('application/json');
    });
  });

  describe('Librarian Hierarchy Resource', () => {
    it('should return hierarchy of all librarians', () => {
      const result = (server as any).readResource('constellation://librarian-hierarchy');
      
      expect(result.contents).toHaveLength(1);
      const text = result.contents[0]?.text;
      if (typeof text !== 'string') {
        throw new Error('Expected text content');
      }
      const hierarchy = JSON.parse(text) as { total: number; librarians: Array<{ id: string; capabilities: string[]; team?: string }> };
      
      expect(hierarchy.total).toBe(3);
      expect(hierarchy.librarians).toHaveLength(3);
      
      const k8sLib = hierarchy.librarians.find((l: { id: string }) => l.id === 'kubernetes');
      expect(k8sLib).toBeDefined();
      expect(k8sLib?.capabilities).toContain('kubernetes.deployment');
      expect(k8sLib?.team).toBe('platform');
    });

    it('should handle unknown resource URI', () => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        (server as any).readResource('constellation://unknown')
      ).toThrow('Unknown resource');
    });
  });

  describe('Response Formatting', () => {
    it('should format successful responses with metadata', async () => {
      const response: Response = {
        answer: 'Test answer',
        confidence: 0.85,
        sources: [
          { name: 'Source 1', url: 'http://example.com' },
          { name: 'Source 2' },
        ],
        metadata: { executionTimeMs: 123 },
      };
      
      const formatted = (server as any).formatResponse(response);
      
      expect(formatted.content).toHaveLength(1);
      const text = formatted.content[0]?.text;
      expect(text).toContain('Test answer');
      expect(text).toContain('Confidence: 0.85');
      expect(text).toContain('Sources:');
      expect(text).toContain('Source 1 (http://example.com)');
      expect(text).toContain('Source 2');
      expect(text).toContain('Execution time: 123ms');
    });

    it('should format error responses', async () => {
      const response: Response = {
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
        },
      };
      
      const formatted = (server as any).formatResponse(response);
      
      expect(formatted.content).toHaveLength(1);
      const text = formatted.content[0]?.text;
      expect(text).toContain('Error: TEST_ERROR');
      expect(text).toContain('Message: Test error message');
    });

    it('should handle delegation responses', async () => {
      const response: Response = {
        delegate: { to: 'other-librarian' },
      };
      
      const formatted = (server as any).formatResponse(response);
      
      expect(formatted.content).toHaveLength(1);
      expect(formatted.content[0]?.text).toContain('delegation');
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const result = await (server as any).executeTool('unknown_tool', {});
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.text).toContain('Error: Unknown tool');
    });
  });
});
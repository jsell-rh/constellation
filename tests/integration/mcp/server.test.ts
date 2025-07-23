/**
 * Integration tests for MCP Server
 * Tests the Model Context Protocol server implementation
 */

import { ConstellationMCPServer } from '../../../src/mcp/server';
import { SimpleRouter } from '../../../src/core/router';
import type { Librarian, Response } from '../../../src/types/core';

describe('MCP Server', () => {
  let server: ConstellationMCPServer;
  let router: SimpleRouter;

  beforeEach(() => {
    router = new SimpleRouter();
    
    // Register test librarians
    const echoLibrarian: Librarian = (query: string): Promise<Response> => {
      return Promise.resolve({ answer: `Echo: ${query}` });
    };
    
    const kubernetesLibrarian: Librarian = (query: string): Promise<Response> => {
      if (query.toLowerCase().includes('deploy')) {
        return Promise.resolve({ answer: 'Use kubectl apply -f deployment.yaml' });
      }
      return Promise.resolve({ answer: 'I can help with Kubernetes questions' });
    };
    
    const errorLibrarian: Librarian = (): Promise<Response> => {
      return Promise.resolve({ 
        error: { 
          code: 'TEST_ERROR', 
          message: 'This is a test error' 
        } 
      });
    };
    
    router.register({
      id: 'echo',
      name: 'Echo Librarian',
      description: 'Echoes back the query',
      capabilities: ['echo', 'test'],
    }, echoLibrarian);
    
    router.register({
      id: 'kubernetes',
      name: 'Kubernetes Expert',
      description: 'Answers Kubernetes questions',
      capabilities: ['kubernetes', 'deployment', 'containers'],
    }, kubernetesLibrarian);
    
    router.register({
      id: 'error-test',
      name: 'Error Test Librarian',
      description: 'Always returns an error',
      capabilities: ['error', 'test'],
    }, errorLibrarian);

    server = new ConstellationMCPServer(router);
  });

  describe('Server Creation', () => {
    it('should create server with router', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(ConstellationMCPServer);
    });

    it('should have registered librarians available', () => {
      expect(router.getAllLibrarians()).toContain('echo');
      expect(router.getAllLibrarians()).toContain('kubernetes');
      expect(router.getAllLibrarians()).toContain('error-test');
    });
  });

  describe('MCP Protocol Support', () => {
    it('should be configured for HTTP transport', () => {
      // The server is designed for HTTP transport mode
      interface ServerWithOptions {
        options: {
          name: string;
          version: string;
        };
      }
      const options = (server as unknown as ServerWithOptions).options;
      expect(options.name).toBe('constellation');
      expect(options.version).toBe('0.1.0');
    });
  });

  // Note: Full integration tests with actual HTTP requests would require
  // starting the server and making real HTTP calls. These tests verify
  // the server setup and configuration.
});
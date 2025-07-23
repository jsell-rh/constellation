/**
 * MCP Server implementation for Constellation
 * Provides a Model Context Protocol interface to the librarian system
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { SimpleRouter } from '../core/router';
import type { Context, Response, User } from '../types/core';
import { DelegationEngine } from '../delegation/engine';
import { createJWTMiddleware, getAuthConfig, getUserFromRequest } from '../auth/jwt-middleware';
import pino from 'pino';
import { z } from 'zod';
import type { Request, Response as ExpressResponse } from 'express';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface MCPServerOptions {
  /** Server name */
  name?: string;
  /** Server version */
  version?: string;
  /** HTTP port for hosted server */
  port?: number;
  /** HTTP host for hosted server */
  host?: string;
}

/**
 * MCP Server that exposes Constellation functionality using the proper McpServer class
 */
export class ConstellationMCPServer {
  private delegationEngine: DelegationEngine;
  private options: MCPServerOptions;

  constructor(
    private router: SimpleRouter,
    options: MCPServerOptions = {}
  ) {
    this.options = {
      name: 'constellation',
      version: process.env.npm_package_version ?? '0.1.0',
      port: 3001,
      host: 'localhost',
      ...options,
    };

    // For stateless mode, we don't create a persistent server instance
    // Instead, we create new instances for each request
    
    // Initialize delegation engine
    this.delegationEngine = new DelegationEngine(router);
  }


  /**
   * Create a new MCP server instance (for stateless mode)
   */
  private createServerInstance(user?: User): McpServer {
    const server = new McpServer({
      name: this.options.name ?? 'constellation',
      version: this.options.version ?? '0.1.0'
    }, {
      capabilities: {
        resources: {},
        tools: {},
      }
    });

    // Register tools and resources on each new instance
    this.registerToolsOnServer(server, user);
    this.registerResourcesOnServer(server);
    
    return server;
  }

  /**
   * Register tools on a server instance
   */
  private registerToolsOnServer(server: McpServer, user?: User): void {
    // Register the main query tool
    server.registerTool(
      'query',
      {
        title: 'Query Constellation',
        description: 'Route queries through the AI delegation engine to find the most appropriate librarian',
        inputSchema: {
          query: z.string().describe('Your question or request'),
          context: z.object({
            user_id: z.string().optional(),
            session_id: z.string().optional(), 
            metadata: z.record(z.unknown()).optional()
          }).optional().describe('Additional context for the query')
        }
      },
      async ({ query, context }) => {
        logger.info({ query }, 'Processing query via delegation engine');
        
        const constellationContext: Context = {
          metadata: {
            source: 'mcp',
            ...(context?.metadata || {})
          },
          // Use authenticated user if available, otherwise fall back to context user_id
          ...(user && { user }),
          ...(context?.user_id && !user && { user: { id: context.user_id } })
        };

        const response = await this.delegationEngine.route(query, constellationContext);
        return this.formatMCPResponse(response);
      }
    );

    // Register the direct librarian query tool
    server.registerTool(
      'query_librarian',
      {
        title: 'Query Specific Librarian',
        description: 'Query a specific librarian directly, bypassing the delegation engine',
        inputSchema: {
          librarian_id: z.string().describe('The ID of the librarian to query'),
          query: z.string().describe('Your question or request'),
          context: z.object({
            user_id: z.string().optional(),
            session_id: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
          }).optional().describe('Additional context for the query')
        }
      },
      async ({ librarian_id, query, context }) => {
        logger.info({ librarian_id, query }, 'Processing direct librarian query');
        
        const constellationContext: Context = {
          metadata: {
            source: 'mcp',
            forced_routing: true,
            ...(context?.metadata || {})
          },
          // Use authenticated user if available, otherwise fall back to context user_id
          ...(user && { user }),
          ...(context?.user_id && !user && { user: { id: context.user_id } })
        };

        const response = await this.router.route(query, librarian_id, constellationContext);
        return this.formatMCPResponse(response);
      }
    );
  }

  /**
   * Register resources on a server instance
   */
  private registerResourcesOnServer(server: McpServer): void {
    server.registerResource(
      'librarian-hierarchy',
      'constellation://librarian-hierarchy',
      {
        title: 'Librarian Hierarchy',
        description: 'The complete hierarchy of available librarians with their capabilities and relationships',
        mimeType: 'application/json'
      },
      () => {
        const librarians = this.router.getAllLibrarians();
        const hierarchy = {
          total: librarians.length,
          librarians: [] as Array<{
            id: string;
            name: string;
            description: string;
            capabilities: string[];
            parent?: string;
            team?: string;
          }>
        };

        for (const id of librarians) {
          const metadata = this.router.getMetadata(id);
          if (metadata) {
            hierarchy.librarians.push({
              id: metadata.id,
              name: metadata.name,
              description: metadata.description,
              capabilities: metadata.capabilities,
              ...(metadata.parent !== undefined && metadata.parent !== '' && { parent: metadata.parent }),
              ...(metadata.team !== undefined && metadata.team !== '' && { team: metadata.team })
            });
          }
        }

        return {
          contents: [
            {
              uri: 'constellation://librarian-hierarchy',
              text: JSON.stringify(hierarchy, null, 2)
            }
          ]
        };
      }
    );
  }

  /**
   * Start the MCP server with HTTP transport (stateless mode)
   */
  async start(): Promise<void> {
    const express = await import('express');
    const cors = await import('cors');
    
    const app = express.default();
    app.use(express.default.json());
    
    // Allow CORS for MCP Inspector and other clients
    app.use(cors.default({
      origin: '*',
      exposedHeaders: ['Mcp-Session-Id']
    }));

    // Health check endpoint (before auth middleware)
    app.get('/health', (_req, res) => {
      res.json({ 
        status: 'ok', 
        server: this.options.name, 
        version: this.options.version,
        librarians: this.router.getAllLibrarians().length,
        protocol: 'MCP (Model Context Protocol)',
        transport: 'HTTP',
        auth: getAuthConfig().enabled ? 'enabled' : 'disabled'
      });
    });

    // Apply JWT authentication middleware
    const authConfig = getAuthConfig();
    if (authConfig.enabled) {
      logger.info('JWT authentication enabled');
      app.use(createJWTMiddleware(authConfig));
    } else {
      logger.warn('JWT authentication disabled - not for production use!');
    }

    // MCP POST endpoint (stateless mode)
    app.post('/mcp', (req: Request, res: ExpressResponse) => {
      // Create new server instance for each request to avoid collisions
      void (async () => {
        try {
          // Extract authenticated user from request
          const user = getUserFromRequest(req);
          
          const server = this.createServerInstance(user);
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // Stateless mode
          });
          
          res.on('close', () => {
            logger.debug('Request closed');
            void transport.close();
            void server.close();
          });
          
          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
          
        } catch (error) {
          logger.error({ error }, 'Error handling MCP request');
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal server error',
              },
              id: null,
            });
          }
        }
      })();
    });

    // SSE notifications not supported in stateless mode
    app.get('/mcp', (_req, res) => {
      logger.debug('Received GET MCP request - not supported in stateless mode');
      res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed."
        },
        id: null
      }));
    });

    // Session termination not needed in stateless mode
    app.delete('/mcp', (_req, res) => {
      logger.debug('Received DELETE MCP request - not supported in stateless mode');
      res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed."
        },
        id: null
      }));
    });

    // Start HTTP server
    const server = app.listen(this.options.port ?? 3001, this.options.host ?? 'localhost', () => {
      const host = this.options.host ?? 'localhost';
      const port = this.options.port ?? 3001;
      const url = `http://${host}:${port}`;
      
      const authEnabled = getAuthConfig().enabled;
      
      console.log(`\n🌟 Constellation MCP Server`);
      console.log(`═══════════════════════════`);
      console.log(`🌐 Server URL: ${url}`);
      console.log(`📡 Health Check: ${url}/health`);
      console.log(`🔌 MCP Endpoint: ${url}/mcp`);
      console.log(`🔐 Authentication: ${authEnabled ? 'ENABLED (JWT)' : 'DISABLED'}`);
      console.log(`📚 Available Tools: query, query_librarian`);
      console.log(`📖 Resources: constellation://librarian-hierarchy`);
      console.log(`🔧 Librarians Registered: ${this.router.getAllLibrarians().length}`);
      console.log(`═══════════════════════════\n`);
      
      logger.info({
        transport: 'http',
        protocol: 'MCP (Model Context Protocol)',
        url,
        endpoints: {
          health: `${url}/health`,
          mcp: `${url}/mcp`
        },
        tools: ['query', 'query_librarian'],
        resources: ['constellation://librarian-hierarchy'],
        librarians: this.router.getAllLibrarians().length
      }, 'MCP server started and ready for connections');
    });

    // Handle shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down MCP server...');
      server.close();
      process.exit(0);
    });
  }


  /**
   * Format a Constellation response for MCP tool result
   */
  private formatMCPResponse(response: Response): { content: Array<{ type: 'text'; text: string }> } {
    const content = [];

    if (response.answer !== undefined) {
      let text = response.answer;

      // Add metadata if present
      if (response.confidence !== undefined) {
        text += `\n\nConfidence: ${response.confidence}`;
      }

      if (response.sources !== undefined && response.sources.length > 0) {
        text += '\n\nSources:';
        for (const source of response.sources) {
          text += `\n- ${source.name}`;
          if (source.url !== undefined && source.url !== '') {
            text += ` (${source.url})`;
          }
        }
      }

      if (response.metadata?.executionTimeMs !== undefined) {
        text += `\n\nExecution time: ${String(response.metadata.executionTimeMs)}ms`;
      }

      content.push({ type: 'text' as const, text });
    }

    if (response.error) {
      const errorText = `Error: ${response.error.code}\nMessage: ${response.error.message}`;
      content.push({ type: 'text' as const, text: errorText });
    }

    if (response.delegate) {
      const delegateText = 'Response requires delegation to specialized librarians.';
      content.push({ type: 'text' as const, text: delegateText });
    }

    return { content };
  }
}

/**
 * Main entry point for running the MCP server with HTTP transport
 */
export async function runMCPServer(router: SimpleRouter): Promise<void> {
  const server = new ConstellationMCPServer(router);
  await server.start();
}
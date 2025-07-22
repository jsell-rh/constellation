/**
 * MCP Server implementation for Constellation
 * Provides a Model Context Protocol interface to the librarian system
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource,
  TextContent,
  ImageContent,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { SimpleRouter } from '../core/router';
import type { Context, Response } from '../types/core';
import { DelegationEngine } from '../delegation/engine';
import pino from 'pino';

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

interface QueryArgs {
  query: string;
  context?: {
    user_id?: string;
    session_id?: string;
    metadata?: Record<string, unknown>;
  };
}

interface QueryLibrarianArgs {
  librarian_id: string;
  query: string;
  context?: {
    user_id?: string;
    session_id?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * MCP Server that exposes Constellation functionality
 */
export class ConstellationMCPServer {
  private server: Server;
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

    this.server = new Server(
      {
        name: this.options.name ?? 'constellation',
        version: this.options.version ?? '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Initialize delegation engine
    this.delegationEngine = new DelegationEngine(router);

    // Set up handlers
    this.setupHandlers();
  }

  /**
   * Start the MCP server with HTTP transport
   */
  async start(): Promise<void> {
    await this.startHttpServer();
  }

  /**
   * Start HTTP server for MCP-over-HTTP
   */
  private async startHttpServer(): Promise<void> {
    const express = await import('express');
    const cors = await import('cors');
    
    const app = express.default();
    app.use(cors.default());
    app.use(express.default.json());

    // Store active transports by session ID
    const transports: Record<string, StreamableHTTPServerTransport> = {};

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({ 
        status: 'ok', 
        server: this.options.name, 
        version: this.options.version,
        librarians: this.router.getAllLibrarians().length,
        protocol: 'MCP (Model Context Protocol)',
        transport: 'HTTP'
      });
    });

    // MCP endpoint for handling MCP requests over HTTP
    app.post('/mcp', async (req, res) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string || req.headers['x-mcp-session-id'] as string;
        let transport = transports[sessionId];

        if (!transport && (!sessionId && isInitializeRequest(req.body))) {
          // New initialization request - create new transport
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => `session-${Date.now()}-${Math.random()}`,
            onsessioninitialized: (id: string) => {
              logger.info(`MCP session initialized: ${id}`);
              if (transport) {
                transports[id] = transport;
              }
            }
          });

          // Clean up transport on close
          transport.onclose = () => {
            const id = transport?.sessionId;
            if (id && transports[id]) {
              logger.info(`MCP session closed: ${id}`);
              delete transports[id];
            }
          };

          // Connect transport to our MCP server
          await this.server.connect(transport);
        } else if (!transport) {
          // No existing transport and not an initialization request
          res.status(400).json({ 
            error: 'Invalid session or missing initialization',
            message: 'Please send an initialization request first'
          });
          return;
        }

        // Let the transport handle the request completely
        // It will handle the response internally
        await transport.handleRequest(req, res);
        
      } catch (error) {
        logger.error({ error }, 'MCP request failed');
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    });

    // MCP GET endpoint for SSE streams 
    app.get('/mcp', async (req, res) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string || req.headers['x-mcp-session-id'] as string;
        
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }

        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
        
      } catch (error) {
        logger.error({ error }, 'MCP GET request failed');
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    });

    // Start the HTTP server
    app.listen(this.options.port ?? 3001, this.options.host ?? 'localhost', () => {
      const host = this.options.host ?? 'localhost';
      const port = this.options.port ?? 3001;
      const url = `http://${host}:${port}`;
      
      console.log(`\n🌟 Constellation MCP Server`);
      console.log(`═══════════════════════════`);
      console.log(`🌐 Server URL: ${url}`);
      console.log(`📡 Health Check: ${url}/health`);
      console.log(`🔌 MCP Endpoint: ${url}/mcp`);
      console.log(`📚 Available Tools: query, query_librarian`);
      console.log(`📖 Resources: constellation://librarian-hierarchy`);
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
        resources: ['constellation://librarian-hierarchy']
      }, 'MCP server started and ready for connections');
    });
  }

  /**
   * Set up MCP protocol handlers
   */
  private setupHandlers(): void {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: this.getTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return this.executeTool(name, args);
    });

    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, () => ({
      resources: this.getResources(),
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, (request) => {
      const { uri } = request.params;
      return this.readResource(uri);
    });
  }

  /**
   * Get available tools
   */
  private getTools(): Tool[] {
    return [
      {
        name: 'query',
        description: 'Query the Constellation knowledge system. The AI delegation engine will automatically route your query to the most appropriate librarian(s).',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Your question or request',
            },
            context: {
              type: 'object',
              description: 'Optional context for the query',
              properties: {
                user_id: { type: 'string' },
                session_id: { type: 'string' },
                metadata: { type: 'object' },
              },
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'query_librarian',
        description: 'Query a specific librarian directly. Use this when you know exactly which librarian to consult.',
        inputSchema: {
          type: 'object',
          properties: {
            librarian_id: {
              type: 'string',
              description: 'The ID of the librarian to query',
            },
            query: {
              type: 'string',
              description: 'Your question or request',
            },
            context: {
              type: 'object',
              description: 'Optional context for the query',
              properties: {
                user_id: { type: 'string' },
                session_id: { type: 'string' },
                metadata: { type: 'object' },
              },
            },
          },
          required: ['librarian_id', 'query'],
        },
      },
    ];
  }

  /**
   * Get available resources
   */
  private getResources(): Resource[] {
    return [
      {
        uri: 'constellation://librarian-hierarchy',
        name: 'Librarian Hierarchy',
        description: 'The complete hierarchy of available librarians with their capabilities and relationships',
        mimeType: 'application/json',
      },
    ];
  }

  /**
   * Execute a tool
   */
  private async executeTool(name: string, args: unknown): Promise<{ content: Array<TextContent | ImageContent> }> {
    try {
      switch (name) {
        case 'query':
          return this.handleQuery(args);
        case 'query_librarian':
          return this.handleQueryLibrarian(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error({ error, tool: name, args }, 'Tool execution error');
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          } as TextContent,
        ],
      };
    }
  }

  /**
   * Handle general query tool
   */
  private async handleQuery(args: unknown): Promise<{ content: Array<TextContent | ImageContent> }> {
    const queryArgs = args as QueryArgs;
    const { query, context: userContext } = queryArgs;

    if (!query || typeof query !== 'string') {
      throw new Error('Missing required argument: query');
    }

    // Create context from MCP request
    const context: Context = {
      metadata: {
        source: 'mcp',
        ...(userContext?.metadata ?? {}),
      },
      ...(userContext?.user_id !== undefined && userContext.user_id !== '' ? { user: { id: userContext.user_id } } : {}),
    };

    // Use delegation engine to route query
    const response = await this.delegationEngine.route(query, context);

    return this.formatResponse(response);
  }

  /**
   * Handle specific librarian query tool
   */
  private async handleQueryLibrarian(args: unknown): Promise<{ content: Array<TextContent | ImageContent> }> {
    const queryLibrarianArgs = args as QueryLibrarianArgs;
    const { librarian_id, query, context: userContext } = queryLibrarianArgs;

    if (!librarian_id || typeof librarian_id !== 'string') {
      throw new Error('Missing required argument: librarian_id');
    }

    if (!query || typeof query !== 'string') {
      throw new Error('Missing required argument: query');
    }

    // Create context
    const context: Context = {
      metadata: {
        source: 'mcp',
        forced_routing: true,
        ...(userContext?.metadata ?? {}),
      },
      ...(userContext?.user_id !== undefined && userContext.user_id !== '' ? { user: { id: userContext.user_id } } : {}),
    };

    // Route directly to specified librarian
    const response = await this.router.route(query, librarian_id, context);

    return this.formatResponse(response);
  }

  /**
   * Read a resource
   */
  private readResource(uri: string): { contents: Array<TextContent | ImageContent> } {
    if (uri === 'constellation://librarian-hierarchy') {
      return this.getLibrarianHierarchy();
    }

    throw new Error(`Unknown resource: ${uri}`);
  }

  /**
   * Get the librarian hierarchy resource
   */
  private getLibrarianHierarchy(): { contents: Array<TextContent | ImageContent> } {
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
      }>,
    };

    // Build hierarchy structure
    for (const id of librarians) {
      const metadata = this.router.getMetadata(id);
      if (metadata) {
        hierarchy.librarians.push({
          id: metadata.id,
          name: metadata.name,
          description: metadata.description,
          capabilities: metadata.capabilities,
          ...(metadata.parent !== undefined && metadata.parent !== '' && { parent: metadata.parent }),
          ...(metadata.team !== undefined && metadata.team !== '' && { team: metadata.team }),
        });
      }
    }

    // TODO: Apply authorization filtering here

    return {
      contents: [
        {
          type: 'text',
          text: JSON.stringify(hierarchy, null, 2),
        } as TextContent,
      ],
    };
  }

  /**
   * Format a librarian response for MCP
   */
  private formatResponse(response: Response): { content: Array<TextContent | ImageContent> } {
    const content: Array<TextContent | ImageContent> = [];

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

      content.push({ type: 'text', text } as TextContent);
    }

    if (response.error) {
      const errorText = `Error: ${response.error.code}\nMessage: ${response.error.message}`;
      content.push({ type: 'text', text: errorText } as TextContent);
    }

    if (response.delegate) {
      // This shouldn't happen with delegation engine, but handle it
      const delegateText = 'Response requires delegation to specialized librarians.';
      content.push({ type: 'text', text: delegateText } as TextContent);
    }

    return { content };
  }
}

/**
 * Main entry point for running the MCP server
 */
export async function runMCPServer(router: SimpleRouter): Promise<void> {
  const server = new ConstellationMCPServer(router);
  await server.start();
  
  // Handle shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down MCP server');
    process.exit(0);
  });
}
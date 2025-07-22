/**
 * Main entry point for Constellation
 * Can be run as an MCP server or imported as a library
 */

import 'dotenv/config';
import { SimpleRouter } from './core/router';
import { runMCPServer } from './mcp/server';
import { createLibrarian } from './types/librarian-factory';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

// Export all public APIs
export * from './types';
export * from './core';
export * from './mcp';

/**
 * Main function to start Constellation as MCP server
 */
async function main(): Promise<void> {
  logger.info('Starting Constellation MCP Server');
  
  console.log('🚀 Starting Constellation...\n');

  // Create router
  const router = new SimpleRouter();

  // Register built-in librarians
  // TODO: Load from registry in Phase 3
  
  // Example: Hello World librarian
  const helloLibrarian = createLibrarian((query) => {
    if (query.toLowerCase().includes('hello')) {
      return Promise.resolve({
        answer: 'Hello! I am Constellation, a distributed AI knowledge orchestration system. How can I help you?',
        confidence: 1.0,
      });
    }
    return Promise.resolve({
      answer: 'I can help you access knowledge from various expert librarians. Try asking about specific topics!',
      confidence: 0.7,
    });
  });

  router.register({
    id: 'hello',
    name: 'Hello World',
    description: 'A friendly greeting librarian',
    capabilities: ['greeting', 'introduction'],
  }, helloLibrarian);

  // TODO: Register more librarians from registry

  const librarianCount = router.getAllLibrarians().length;
  logger.info(`Registered ${librarianCount} librarians`);

  // Start MCP server
  await runMCPServer(router);
}

// Run if called directly
if (require.main === module) {
  main().catch((error: unknown) => {
    logger.error({ error }, 'Failed to start Constellation');
    process.exit(1);
  });
}
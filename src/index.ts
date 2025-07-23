/**
 * Main entry point for Constellation
 * Can be run as an MCP server or imported as a library
 */

import 'dotenv/config';
import { SimpleRouter } from './core/router';
import { LibrarianExecutor } from './core/executor';
import { runMCPServer } from './mcp/server';
import { createLibrarian } from './types/librarian-factory';
import { createAIClientFromEnv } from './ai/client';
import { loadLibrarians } from './registry/secure-loader';
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

  // Initialize AI client (optional - only if configured)
  let aiClient = null;
  try {
    aiClient = createAIClientFromEnv();
    logger.info({
      defaultProvider: aiClient.defaultProvider.name,
      availableProviders: aiClient.getAvailableProviders(),
    }, 'AI client initialized');
  } catch (error) {
    logger.warn('No AI providers configured - librarians will run without AI capabilities');
  }

  // Create executor with AI client
  const executor = new LibrarianExecutor({
    ...(aiClient && { aiClient }),
  });

  // Create router with AI-enabled executor
  const router = new SimpleRouter({ executor });

  // Load librarians from secure registry
  const registryPath = process.env.REGISTRY_PATH || './registry/constellation-registry.yaml';
  
  try {
    logger.info({ path: registryPath }, 'Loading librarians from registry');
    await loadLibrarians(registryPath, router);
    
    // Add AI client to router context for librarians that need it
    if (aiClient) {
      router.setDefaultContext({ ai: aiClient });
    }
  } catch (error) {
    logger.error({ error, path: registryPath }, 'Failed to load registry');
    
    // Fallback: Register a minimal hello librarian
    logger.warn('Registering fallback hello librarian');
    const helloLibrarian = createLibrarian((_query) => {
      return Promise.resolve({
        answer: 'Registry loading failed. This is a fallback librarian. Please check your registry configuration.',
        error: {
          code: 'REGISTRY_LOAD_FAILED',
          message: 'Could not load librarians from registry',
          recoverable: true,
        },
      });
    });
    
    router.register({
      id: 'hello-fallback',
      name: 'Fallback Hello',
      description: 'Emergency fallback librarian',
      capabilities: ['greeting'],
    }, helloLibrarian);
  }

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
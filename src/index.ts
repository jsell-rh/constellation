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
import { initializeTracing, initializeMetricsEndpoint } from './observability';
import { createLogger } from './observability/logger';
import express from 'express';

const logger = createLogger('main');

// Export all public APIs
export * from './types';
export * from './core';
export * from './mcp';

/**
 * Main function to start Constellation as MCP server
 */
async function main(): Promise<void> {
  logger.info(
    {
      service: 'constellation',
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
    },
    'Starting Constellation MCP Server',
  );

  // Initialize OpenTelemetry tracing
  initializeTracing({
    serviceName: 'constellation',
    enabled: process.env.TRACE_ENABLED === 'true',
  });

  // Initialize Prometheus metrics endpoint if enabled
  if (process.env.METRICS_ENABLED !== 'false') {
    const metricsApp = express();
    const metricsPort = parseInt(process.env.METRICS_PORT || '9090');

    // Add metrics endpoint
    initializeMetricsEndpoint(metricsApp, metricsPort);

    // Start the metrics server
    metricsApp.listen(metricsPort, () => {
      logger.info(
        {
          port: metricsPort,
          endpoint: `/metrics`,
          url: `http://localhost:${metricsPort}/metrics`,
        },
        'Prometheus metrics server started',
      );
    });
  }

  // Initialize AI client (optional - only if configured)
  let aiClient = null;
  try {
    aiClient = createAIClientFromEnv();
    logger.info(
      {
        defaultProvider: aiClient.defaultProvider.name,
        availableProviders: aiClient.getAvailableProviders(),
      },
      'AI client initialized',
    );
  } catch (error) {
    logger.warn(
      {
        err: error,
        errorCode: 'AI_CONFIG_MISSING',
        errorType: 'CONFIGURATION_ERROR',
        recoverable: true,
      },
      'No AI providers configured - librarians will run without AI capabilities',
    );
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
    logger.error(
      {
        err: error,
        path: registryPath,
        errorCode: 'REGISTRY_LOAD_FAILED',
        errorType: 'CONFIGURATION_ERROR',
        recoverable: true,
      },
      'Failed to load registry',
    );

    // Fallback: Register a minimal hello librarian
    logger.warn(
      {
        fallbackId: 'hello-fallback',
        reason: 'registry_load_failed',
      },
      'Registering fallback hello librarian',
    );
    const helloLibrarian = createLibrarian((_query) => {
      return Promise.resolve({
        answer:
          'Registry loading failed. This is a fallback librarian. Please check your registry configuration.',
        error: {
          code: 'REGISTRY_LOAD_FAILED',
          message: 'Could not load librarians from registry',
          recoverable: true,
        },
      });
    });

    router.register(
      {
        id: 'hello-fallback',
        name: 'Fallback Hello',
        description: 'Emergency fallback librarian',
        capabilities: ['greeting'],
      },
      helloLibrarian,
    );
  }

  const librarianCount = router.getAllLibrarians().length;
  logger.info(
    {
      librarianCount,
      librarians: router.getAllLibrarians(),
    },
    'Librarians registered successfully',
  );

  // Start MCP server
  await runMCPServer(router);
}

// Run if called directly
if (require.main === module) {
  main().catch((error: unknown) => {
    logger.error(
      {
        err: error,
        errorCode: 'STARTUP_FAILED',
        errorType: 'FATAL_ERROR',
        recoverable: false,
      },
      'Failed to start Constellation',
    );
    process.exit(1);
  });
}

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
import { aiAssistantLibrarian, kubernetesExpertLibrarian, codeReviewLibrarian } from './examples/ai-assistant-librarian';
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

  // Register AI-powered librarians if AI is available
  if (aiClient) {
    router.register({
      id: 'ai-assistant',
      name: 'AI Assistant',
      description: 'General purpose AI assistant that can answer a wide variety of questions',
      capabilities: ['general-knowledge', 'question-answering', 'conversation'],
    }, aiAssistantLibrarian);

    router.register({
      id: 'kubernetes-expert',
      name: 'Kubernetes Expert',
      description: 'Specialized AI assistant with deep Kubernetes and cloud-native expertise',
      capabilities: ['kubernetes', 'k8s', 'containers', 'orchestration', 'devops', 'helm'],
    }, kubernetesExpertLibrarian);

    router.register({
      id: 'code-reviewer',
      name: 'Code Reviewer',
      description: 'AI-powered code review assistant for identifying bugs, security issues, and improvements',
      capabilities: ['code-review', 'debugging', 'security', 'performance', 'refactoring'],
    }, codeReviewLibrarian);

    logger.info('Registered AI-powered librarians');
  }

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
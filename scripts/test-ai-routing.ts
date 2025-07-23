#!/usr/bin/env tsx
/**
 * Test script for AI-powered routing with local Ollama instance
 * Run with: tsx scripts/test-ai-routing.ts
 */

import { SimpleRouter } from '../src/core/router';
import { LibrarianExecutor } from '../src/core/executor';
import { DelegationEngine } from '../src/delegation/engine';
import { ConstellationAIClient } from '../src/ai/client';
import { createLibrarian } from '../src/types/librarian-factory';
import type { LibrarianInfo, Context } from '../src/types/core';
import { getLibrarianRegistry } from '../src/registry/librarian-registry';
import pino from 'pino';

const logger = pino({
  level: 'info',
  transport: { target: 'pino-pretty' },
});

// Create AI client configured for local Ollama
const aiClient = new ConstellationAIClient({
  defaultProvider: 'openai',
  openai: {
    apiKey: 'ollama', // Ollama doesn't need a real API key
    model: 'qwen3:8b',
    baseURL: 'http://localhost:11434/v1', // Ollama OpenAI-compatible endpoint
    temperature: 0.3,
    max_tokens: 1000,
  },
});

// Create executor with AI client
const executor = new LibrarianExecutor({ aiClient });

// Create router
const router = new SimpleRouter({ executor });

// Create sample librarians
const kubernetesLibrarian = createLibrarian(async (query: string, context?: Context) => {
  logger.info({ query }, 'Kubernetes librarian handling query');

  if (context?.ai) {
    const prompt = `You are a Kubernetes expert. Answer this question concisely: ${query}`;
    const answer = await context.ai.ask(prompt);
    return { answer, confidence: 0.9 };
  }

  return { answer: 'I can help with Kubernetes deployments, pods, services, and more.' };
});

const wikiLibrarian = createLibrarian(async (query: string, context?: Context) => {
  logger.info({ query }, 'Wiki librarian handling query');

  if (context?.ai) {
    const prompt = `You are a company wiki assistant. Answer this question about documentation: ${query}`;
    const answer = await context.ai.ask(prompt);
    return { answer, confidence: 0.8 };
  }

  return { answer: 'I can help search the company wiki and documentation.' };
});

const hrLibrarian = createLibrarian(async (query: string, context?: Context) => {
  logger.info({ query }, 'HR librarian handling query');

  if (context?.ai) {
    const prompt = `You are an HR assistant. Answer this question about HR policies: ${query}`;
    const answer = await context.ai.ask(prompt);
    return { answer, confidence: 0.85 };
  }

  return { answer: 'I can help with HR policies, benefits, and employee questions.' };
});

// Register librarians with metadata
const librarians: Array<{ info: LibrarianInfo; fn: any }> = [
  {
    info: {
      id: 'kubernetes-ops',
      name: 'Kubernetes Operations',
      description: 'Manages Kubernetes clusters and deployments',
      capabilities: ['kubernetes.operations', 'deployment.management', 'container.orchestration'],
      team: 'platform',
    },
    fn: kubernetesLibrarian,
  },
  {
    info: {
      id: 'wiki-search',
      name: 'Wiki Search',
      description: 'Searches company wiki and documentation',
      capabilities: ['search.wiki', 'documentation.retrieval', 'knowledge.base'],
      team: 'it',
    },
    fn: wikiLibrarian,
  },
  {
    info: {
      id: 'hr-assistant',
      name: 'HR Assistant',
      description: 'Helps with HR policies and employee questions',
      capabilities: ['hr.policies', 'employee.benefits', 'workplace.culture'],
      team: 'hr',
    },
    fn: hrLibrarian,
  },
];

// Register with router and registry
const registry = getLibrarianRegistry();
for (const { info, fn } of librarians) {
  router.register(info, fn);

  // Register in global registry with permissions
  registry.register({
    id: info.id,
    function: '', // Not used in this test
    team: info.team || 'default',
    name: info.name,
    description: info.description,
    permissions: {
      public: info.id === 'wiki-search', // Make wiki public
      allowedTeams: info.id === 'kubernetes-ops' ? ['platform', 'devops'] : undefined,
      allowedRoles: info.id === 'hr-assistant' ? ['hr-staff', 'manager'] : undefined,
    },
  });
}

// Set default context with AI
router.setDefaultContext({ ai: aiClient });

// Create delegation engine
const delegationEngine = new DelegationEngine(router);

// Test queries
async function testQueries() {
  logger.info('Testing AI-powered routing with local Ollama...\n');

  const testCases = [
    {
      query: 'How do I deploy my app to Kubernetes?',
      user: { id: 'dev123', teams: ['platform'], roles: ['developer'] },
    },
    {
      query: 'What is the vacation policy?',
      user: { id: 'emp456', teams: ['engineering'], roles: ['employee'] },
    },
    {
      query: 'Search for deployment documentation',
      user: { id: 'usr789', teams: ['qa'], roles: ['tester'] },
    },
    {
      query: 'How many pods are running in production?',
      user: { id: 'ops321', teams: ['devops'], roles: ['sre'] },
    },
  ];

  for (const { query, user } of testCases) {
    logger.info({ query, user: user.id }, '\n🔍 Testing query');

    try {
      const context: Context = {
        user,
        ai: aiClient,
        trace: {
          traceId: `test-${Date.now()}`,
          spanId: `span-${Date.now()}`,
        },
      };

      const response = await delegationEngine.route(query, context);

      if (response.error) {
        logger.error({ error: response.error }, '❌ Error response');
      } else {
        logger.info(
          {
            answer: response.answer?.substring(0, 100) + '...',
            metadata: response.metadata,
          },
          '✅ Success response',
        );
      }
    } catch (error) {
      logger.error({ error }, '💥 Unexpected error');
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Run tests
testQueries()
  .then(() => {
    logger.info('✨ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ error }, '💥 Test failed');
    process.exit(1);
  });

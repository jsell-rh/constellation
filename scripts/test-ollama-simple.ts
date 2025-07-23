#!/usr/bin/env tsx
/**
 * Simple test of Ollama integration
 * Tests just the AI provider without the full routing complexity
 */

import { ConstellationAIClient } from '../src/ai/client';
import pino from 'pino';

const logger = pino({ level: 'info' });

async function testOllama() {
  logger.info('Testing Ollama integration...\n');

  // Create AI client for Ollama
  const aiClient = new ConstellationAIClient({
    defaultProvider: 'openai',
    openai: {
      apiKey: 'ollama',
      model: 'qwen3:8b',
      baseURL: 'http://localhost:11434/v1',
      temperature: 0.3,
      max_tokens: 500,
    },
  });

  logger.info(
    {
      provider: aiClient.defaultProvider.name,
      available: aiClient.defaultProvider.isAvailable(),
    },
    'AI client created',
  );

  // Test 1: Simple query
  try {
    logger.info('Test 1: Simple AI query...');
    const response = await aiClient.ask('What is Kubernetes in one sentence?', {
      temperature: 0.3,
      max_tokens: 100,
    });
    logger.info({ response }, '✅ Simple query success');
  } catch (error) {
    logger.error({ error }, '❌ Simple query failed');
  }

  // Test 2: Query analysis (like AI analyzer does)
  try {
    logger.info('\nTest 2: Query intent analysis...');
    const prompt = `Analyze this query and determine:
1. The user's intent (what they want to accomplish)
2. Required capabilities to answer this query (as dot-separated paths like "kubernetes.operations" or "ai.analysis")

Query: "How do I deploy my Python app to Kubernetes?"

Respond in JSON format:
{
  "intent": "brief description of what user wants",
  "capabilities": ["capability1", "capability2", ...]
}`;

    const response = await aiClient.ask(prompt, { temperature: 0.3 });
    logger.info({ response }, '✅ Query analysis success');

    try {
      const parsed = JSON.parse(response);
      logger.info({ parsed }, 'Parsed analysis');
    } catch (e) {
      logger.warn('Could not parse JSON response');
    }
  } catch (error) {
    logger.error({ error }, '❌ Query analysis failed');
  }

  // Test 3: Relevance scoring (like AI analyzer does)
  try {
    logger.info('\nTest 3: Relevance scoring...');
    const prompt = `Score how well this librarian matches the query on a scale of 0-100.

Query: "How do I deploy my app to Kubernetes?"
Query Intent: Deploy application to Kubernetes
Required Capabilities: kubernetes.operations, deployment.management

Librarian: Kubernetes Operations
Description: Manages Kubernetes clusters and deployments
Capabilities: kubernetes.operations, deployment.management, container.orchestration
Team: platform

Consider:
1. How well the librarian's capabilities match the required capabilities
2. How well the librarian's description aligns with the query intent
3. Whether this is the librarian's primary expertise area

Respond with just a number between 0-100.`;

    const response = await aiClient.ask(prompt, { temperature: 0.2, max_tokens: 10 });
    logger.info({ response }, '✅ Relevance scoring success');
  } catch (error) {
    logger.error({ error }, '❌ Relevance scoring failed');
  }

  // Test 4: Test with multiple messages (chat format)
  try {
    logger.info('\nTest 4: Chat format...');
    const response = await aiClient.complete(
      [
        { role: 'system', content: 'You are a Kubernetes expert.' },
        { role: 'user', content: 'What is a pod?' },
      ],
      { max_tokens: 100 },
    );
    logger.info(
      {
        content: response.content.substring(0, 100) + '...',
        usage: response.usage,
      },
      '✅ Chat format success',
    );
  } catch (error) {
    logger.error({ error }, '❌ Chat format failed');
  }
}

testOllama()
  .then(() => {
    logger.info('\n✨ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ error }, '💥 Test failed');
    process.exit(1);
  });

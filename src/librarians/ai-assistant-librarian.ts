/**
 * General Purpose AI Assistant Librarian
 * Uses the configured AI provider to answer general questions
 */

import type { Context, Response } from '../types/core';

export default async function aiAssistantLibrarian(query: string, context?: Context): Promise<Response> {
  // Check if AI is available
  if (!context?.ai) {
    return {
      error: {
        code: 'AI_NOT_CONFIGURED',
        message: 'AI capabilities are not configured. Please set up an AI provider in your environment.',
        recoverable: true,
      },
    };
  }

  try {
    // Use AI to generate a helpful response
    const prompt = `You are a helpful AI assistant that is part of the Constellation distributed knowledge system. 
Please answer the following question concisely and accurately:

${query}`;

    const answer = await context.ai.ask(prompt, {
      temperature: 0.7,
      max_tokens: 500,
    });

    return {
      answer,
      confidence: 0.8,
      metadata: {
        model: context.ai.defaultProvider.name,
        librarian: 'ai-assistant',
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'AI_GENERATION_FAILED',
        message: `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
      },
    };
  }
}
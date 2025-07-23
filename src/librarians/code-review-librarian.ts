/**
 * Code Review Librarian
 * AI-powered code review for security, bugs, and best practices
 */

import type { Context } from '../types/core';

export default async function codeReviewLibrarian(query: string, context?: Context) {
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

  // Check if user has appropriate access
  if (context.user && !context.user.teams?.some(team => 
    ['engineering', 'security', 'qa'].includes(team)
  )) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Code review access requires membership in engineering, security, or QA teams',
      },
    };
  }

  try {
    // Use AI for code review
    const prompt = `You are an expert code reviewer that is part of the Constellation distributed knowledge system.
You specialize in:
- Security vulnerability detection
- Bug identification
- Performance optimization
- Code quality and maintainability
- Best practices and design patterns

Please analyze and provide feedback on:

${query}

Focus on:
1. Security issues (injection, XSS, authentication flaws)
2. Potential bugs or logic errors
3. Performance concerns
4. Code readability and maintainability
5. Suggestions for improvement`;

    const answer = await context.ai.ask(prompt, {
      temperature: 0.2, // Very low temperature for consistent technical analysis
      max_tokens: 1000,
    });

    return {
      answer,
      confidence: 0.85,
      metadata: {
        model: context.ai.defaultProvider.name,
        librarian: 'code-reviewer',
        reviewFocus: ['security', 'bugs', 'performance', 'quality'],
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'AI_GENERATION_FAILED',
        message: `Failed to perform code review: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
      },
    };
  }
}
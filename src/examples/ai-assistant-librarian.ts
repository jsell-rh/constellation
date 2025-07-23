/**
 * AI-powered assistant librarian example
 * Demonstrates how to use the AI client within a librarian
 */

import { createLibrarian } from '../types/librarian-factory';
import type { Context, Response } from '../types/core';

/**
 * An AI-powered librarian that can answer general questions using AI
 */
export const aiAssistantLibrarian = createLibrarian(async (query: string, context?: Context): Promise<Response> => {
  // Check if AI is available
  if (!context?.ai) {
    return {
      answer: 'I need access to AI capabilities to answer your question. Please ensure AI providers are configured.',
      confidence: 0.1,
    };
  }

  try {
    // Use AI to generate a helpful response
    const aiResponse = await context.ai.ask(
      `You are a helpful AI assistant. Please provide a clear, accurate, and helpful response to the following question: ${query}`,
      {
        temperature: 0.7,
        max_tokens: 1000,
      }
    );

    return {
      answer: aiResponse,
      confidence: 0.9,
      sources: [
        {
          name: `AI Assistant (${context.ai.defaultProvider.name})`,
          type: 'api',
          timestamp: Date.now(),
        }
      ],
      metadata: {
        provider: context.ai.defaultProvider.name,
        aiGenerated: true,
      },
    };
  } catch (error) {
    return {
      answer: 'I apologize, but I encountered an error while trying to generate a response. Please try again later.',
      error: {
        code: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'Unknown AI error',
        recoverable: true,
      },
      confidence: 0.0,
    };
  }
});

/**
 * Kubernetes expert librarian that uses AI with specialized knowledge
 */
export const kubernetesExpertLibrarian = createLibrarian(async (query: string, context?: Context): Promise<Response> => {
  // Check if this query is related to Kubernetes
  const k8sKeywords = ['kubernetes', 'k8s', 'pod', 'deployment', 'service', 'namespace', 'ingress', 'helm', 'kubectl'];
  const isK8sRelated = k8sKeywords.some(keyword => 
    query.toLowerCase().includes(keyword.toLowerCase())
  );

  if (!isK8sRelated) {
    return {
      delegate: {
        to: 'ai-assistant',
        query,
      },
      confidence: 0.0,
    };
  }

  if (!context?.ai) {
    return {
      answer: 'I need access to AI capabilities to provide Kubernetes expertise. Please ensure AI providers are configured.',
      confidence: 0.1,
    };
  }

  try {
    const systemPrompt = `You are a Kubernetes expert with deep knowledge of container orchestration, cloud-native technologies, and DevOps practices. 

Key areas of expertise:
- Kubernetes core concepts (Pods, Services, Deployments, etc.)
- Cluster management and administration
- Helm charts and package management
- Troubleshooting and debugging
- Security best practices
- Performance optimization
- CI/CD integration

Provide detailed, accurate, and actionable advice. Include command examples when relevant.`;

    const aiResponse = await context.ai.complete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ], {
      temperature: 0.3, // Lower temperature for technical accuracy
      max_tokens: 2000,
    });

    return {
      answer: aiResponse.content,
      confidence: 0.95,
      sources: [
        {
          name: `Kubernetes Expert AI (${context.ai.defaultProvider.name})`,
          type: 'api',
          timestamp: Date.now(),
        }
      ],
      metadata: {
        provider: context.ai.defaultProvider.name,
        specialty: 'kubernetes',
        aiGenerated: true,
        usage: aiResponse.usage,
      },
    };
  } catch (error) {
    return {
      answer: 'I apologize, but I encountered an error while accessing my Kubernetes knowledge base. Please try again later.',
      error: {
        code: 'K8S_AI_ERROR',
        message: error instanceof Error ? error.message : 'Unknown AI error',
        recoverable: true,
      },
      confidence: 0.0,
    };
  }
});

/**
 * Code review librarian that uses AI to analyze code
 */
export const codeReviewLibrarian = createLibrarian(async (query: string, context?: Context): Promise<Response> => {
  // Check if this appears to be a code review request
  const codeKeywords = ['review', 'code', 'function', 'class', 'bug', 'refactor', 'optimize', '```', 'def ', 'const ', 'function '];
  const isCodeRelated = codeKeywords.some(keyword => 
    query.toLowerCase().includes(keyword.toLowerCase())
  );

  if (!isCodeRelated) {
    return {
      delegate: {
        to: 'ai-assistant',
        query,
      },
      confidence: 0.0,
    };
  }

  if (!context?.ai) {
    return {
      answer: 'I need access to AI capabilities to perform code reviews. Please ensure AI providers are configured.',
      confidence: 0.1,
    };
  }

  try {
    const systemPrompt = `You are an expert code reviewer with deep knowledge of software engineering best practices, security, and performance optimization.

Review guidelines:
- Check for bugs, security vulnerabilities, and performance issues
- Suggest improvements for readability and maintainability
- Identify code smells and anti-patterns
- Recommend better algorithms or data structures where applicable
- Consider error handling and edge cases
- Evaluate adherence to coding standards and conventions

Provide constructive feedback with specific recommendations and examples.`;

    const aiResponse = await context.ai.complete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ], {
      temperature: 0.2, // Very low temperature for consistent analysis
      max_tokens: 3000,
    });

    return {
      answer: aiResponse.content,
      confidence: 0.9,
      sources: [
        {
          name: `Code Review AI (${context.ai.defaultProvider.name})`,
          type: 'api',
          timestamp: Date.now(),
        }
      ],
      metadata: {
        provider: context.ai.defaultProvider.name,
        specialty: 'code-review',
        aiGenerated: true,
        usage: aiResponse.usage,
      },
    };
  } catch (error) {
    return {
      answer: 'I apologize, but I encountered an error while performing the code review. Please try again later.',
      error: {
        code: 'CODE_REVIEW_AI_ERROR',
        message: error instanceof Error ? error.message : 'Unknown AI error',
        recoverable: true,
      },
      confidence: 0.0,
    };
  }
});
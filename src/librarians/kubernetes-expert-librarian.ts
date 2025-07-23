/**
 * Kubernetes Expert Librarian
 * Specialized AI assistant for Kubernetes and cloud-native questions
 */

import type { Context, Response } from '../types/core';

export default async function kubernetesExpertLibrarian(query: string, context?: Context): Promise<Response> {
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
    // Use AI with Kubernetes expertise
    const prompt = `You are a Kubernetes and cloud-native expert that is part of the Constellation distributed knowledge system. 
You have deep knowledge of:
- Kubernetes architecture and components
- Container orchestration patterns
- Helm charts and package management
- Service mesh (Istio, Linkerd)
- Observability (Prometheus, Grafana)
- Security best practices
- Troubleshooting and performance optimization

Please provide a detailed and accurate answer to:

${query}`;

    const answer = await context.ai.ask(prompt, {
      temperature: 0.3, // Lower temperature for more focused technical answers
      max_tokens: 800,
    });

    return {
      answer,
      confidence: 0.9,
      metadata: {
        model: context.ai.defaultProvider.name,
        librarian: 'kubernetes-expert',
        expertise: ['kubernetes', 'containers', 'cloud-native'],
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'AI_GENERATION_FAILED',
        message: `Failed to generate Kubernetes expertise: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
      },
    };
  }
}
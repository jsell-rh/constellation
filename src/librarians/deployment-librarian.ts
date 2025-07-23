/**
 * Deployment Assistant Librarian
 * Helps with deployment configurations and troubleshooting
 */

import type { Context } from '../types/core';

export default async function deploymentLibrarian(query: string, context?: Context) {
  const lowerQuery = query.toLowerCase();
  
  // Check team access
  if (context?.user && !context.user.teams?.some(team => 
    ['platform', 'sre', 'devops'].includes(team)
  )) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Deployment assistance requires platform, SRE, or DevOps team membership',
      },
    };
  }
  
  // Simple pattern matching for common deployment questions
  if (lowerQuery.includes('rollback')) {
    return {
      answer: 'To rollback a deployment: 1) Check current deployment status with `kubectl rollout status`, 2) View rollout history with `kubectl rollout history`, 3) Rollback with `kubectl rollout undo deployment/<name>`. Always verify the rollback completed successfully.',
      confidence: 0.9,
      sources: [{
        name: 'Kubernetes deployment best practices',
        type: 'document' as const,
      }],
    };
  }
  
  if (lowerQuery.includes('blue') && lowerQuery.includes('green')) {
    return {
      answer: 'Blue-green deployment: 1) Deploy new version to "green" environment, 2) Run smoke tests, 3) Switch traffic from "blue" to "green", 4) Keep "blue" as rollback option. This ensures zero-downtime deployments.',
      confidence: 0.85,
    };
  }
  
  if (lowerQuery.includes('canary')) {
    return {
      answer: 'Canary deployment: 1) Deploy new version to small subset (5-10%), 2) Monitor metrics and errors, 3) Gradually increase traffic percentage, 4) Roll back if issues detected. Use Flagger or Argo Rollouts for automation.',
      confidence: 0.85,
    };
  }
  
  // Default response with AI fallback
  if (context?.ai) {
    const prompt = `You are a deployment expert. Answer this deployment question concisely: ${query}`;
    try {
      const answer = await context.ai.ask(prompt, { max_tokens: 300 });
      return { answer, confidence: 0.8 };
    } catch {
      // Fall through to default
    }
  }
  
  return {
    answer: 'I can help with deployment strategies (blue-green, canary, rolling), rollbacks, and troubleshooting. What specific deployment question do you have?',
    confidence: 0.7,
  };
}
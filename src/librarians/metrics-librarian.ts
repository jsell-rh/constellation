/**
 * Metrics Analyzer Librarian
 * Analyzes system metrics and performance data
 * NOTE: This librarian handles sensitive data and has extra audit logging
 */

import type { Context } from '../types/core';

export default async function metricsLibrarian(query: string, context?: Context) {
  // This librarian is marked as handling sensitive data
  // The framework will automatically add extra audit logging
  
  // Check team access
  if (context?.user && !context.user.teams?.some(team => 
    ['analytics', 'sre', 'management'].includes(team)
  )) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Metrics access requires analytics, SRE, or management team membership',
      },
    };
  }
  
  const lowerQuery = query.toLowerCase();
  
  // Simulate metrics analysis
  if (lowerQuery.includes('latency')) {
    return {
      answer: 'Current system latency metrics: P50: 45ms, P95: 120ms, P99: 250ms. All within SLA bounds. Slight increase in P99 latency observed in the last hour, likely due to increased traffic.',
      confidence: 0.9,
      metadata: {
        metricsWindow: '1 hour',
        lastUpdated: new Date().toISOString(),
      },
    };
  }
  
  if (lowerQuery.includes('error rate')) {
    return {
      answer: 'System error rates: Overall: 0.12%, API Gateway: 0.08%, Database: 0.02%, External Services: 0.31%. The external service errors are within expected bounds.',
      confidence: 0.9,
      metadata: {
        metricsWindow: '15 minutes',
        threshold: '1% error rate',
      },
    };
  }
  
  if (lowerQuery.includes('capacity') || lowerQuery.includes('scaling')) {
    return {
      answer: 'Current capacity utilization: CPU: 68%, Memory: 72%, Database connections: 45%. Auto-scaling is active. Recommended to plan capacity increase if sustained growth continues for 2 more weeks.',
      confidence: 0.85,
      sources: [{
        name: 'Prometheus metrics',
        type: 'api' as const,
      }],
    };
  }
  
  // AI-powered analysis for complex queries
  if (context?.ai && !lowerQuery.includes('simple')) {
    try {
      const prompt = `As a metrics expert, analyze this performance question: ${query}. Provide specific metrics and recommendations.`;
      const answer = await context.ai.ask(prompt, { 
        temperature: 0.3,
        max_tokens: 400,
      });
      return {
        answer,
        confidence: 0.8,
        metadata: {
          analysisType: 'ai-powered',
          sensitiveData: true,
        },
      };
    } catch {
      // Fall through to default
    }
  }
  
  return {
    answer: 'I can analyze system metrics including latency, error rates, capacity, and performance trends. What specific metrics would you like to review?',
    confidence: 0.7,
  };
}
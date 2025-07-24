/**
 * Basic delegation engine for intelligent query routing
 * This is a simplified version that will be enhanced in Phase 4
 */

import type { SimpleRouter } from '../core/router';
import type { Context, Response } from '../types/core';
import type { AIClient } from '../ai/interface';
import { errorResponse } from '../types/librarian-factory';
import { AIQueryAnalyzer } from './ai-analyzer';
import { DelegationExecutor } from './executor';
import { getAIClient } from '../ai/client';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface DelegationDecision {
  librarians: string[];
  confidence: number;
  reasoning?: string;
}

export interface DelegationEngineOptions {
  aiClient?: AIClient;
}

/**
 * Engine for intelligent query delegation
 * Currently implements simple keyword matching, will be enhanced with AI
 */
export class DelegationEngine {
  private aiAnalyzer?: AIQueryAnalyzer;
  private executor: DelegationExecutor;

  constructor(
    private router: SimpleRouter,
    options: DelegationEngineOptions = {},
  ) {
    this.executor = new DelegationExecutor(router);
    // Try to use provided AI client first, then fall back to global client
    try {
      const aiClient = options.aiClient || getAIClient();
      if (aiClient.defaultProvider.isAvailable()) {
        this.aiAnalyzer = new AIQueryAnalyzer(aiClient);
        logger.info('Delegation engine initialized with AI support');
      } else {
        logger.warn('AI provider not available, using simple routing');
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to initialize AI analyzer, using simple routing');
    }
  }

  /**
   * Route a query to the most appropriate librarian(s)
   */
  async route(query: string, context: Context): Promise<Response> {
    logger.info({ query }, 'Delegation engine routing query');

    // Get all available librarians
    const allLibrarians = this.router.getAllLibrarians();

    if (allLibrarians.length === 0) {
      return errorResponse('NO_LIBRARIANS', 'No librarians available to handle queries');
    }

    // Get librarian metadata for AI analysis
    const librarianInfos = allLibrarians
      .map((id) => {
        const metadata = this.router.getMetadata(id);
        return metadata || null;
      })
      .filter((info): info is NonNullable<typeof info> => info !== null);

    // Use AI-powered routing if available
    let decision: DelegationDecision;
    let engine: string;

    if (this.aiAnalyzer && context.ai) {
      try {
        logger.debug('Using AI-powered query analysis');
        const analysis = await this.aiAnalyzer.analyze(query, librarianInfos, context);
        decision = analysis.decision;
        engine = 'ai-powered';

        logger.info(
          {
            intent: analysis.queryIntent,
            capabilities: analysis.requiredCapabilities,
            candidates: analysis.candidates.length,
          },
          'AI analysis complete',
        );
      } catch (error) {
        logger.error({ error }, 'AI analysis failed, falling back to simple routing');
        decision = this.analyzeQuery(query, context);
        engine = 'simple-fallback';
      }
    } else {
      // Fallback to simple keyword matching
      decision = this.analyzeQuery(query, context);
      engine = 'simple';
    }

    if (decision.librarians.length === 0) {
      return errorResponse('NO_MATCH', 'No suitable librarian found for your query', {
        suggestion: 'Try rephrasing your question or ask for available capabilities',
        details: { reasoning: decision.reasoning },
      });
    }

    // For now, route to the first matching librarian
    // TODO: Implement parallel routing and response aggregation
    const primaryLibrarian = decision.librarians[0];

    if (primaryLibrarian === undefined) {
      return errorResponse('NO_MATCH', 'No librarian selected for routing');
    }

    logger.info({ librarian: primaryLibrarian, decision, engine }, 'Routing to librarian');

    // Use the executor to handle delegation
    const response = await this.executor.execute(query, primaryLibrarian, context);

    // Add delegation metadata
    if (!response.error) {
      response.metadata = {
        ...response.metadata,
        delegation: {
          engine,
          decision: decision.librarians,
          reasoning: decision.reasoning,
          confidence: decision.confidence,
        },
      };
    }

    return response;
  }

  /**
   * Analyze query to determine best librarian(s)
   * TODO: Replace with AI-based analysis
   */
  private analyzeQuery(query: string, _context: Context): DelegationDecision {
    const queryLower = query.toLowerCase();
    const matches: Array<{ id: string; score: number }> = [];

    // Score each librarian based on simple heuristics
    for (const librarianId of this.router.getAllLibrarians()) {
      const metadata = this.router.getMetadata(librarianId);
      if (!metadata) continue;

      let score = 0;

      // Check if query contains librarian name
      if (queryLower.includes(metadata.name.toLowerCase())) {
        score += 10;
      }

      // Check capabilities
      for (const capability of metadata.capabilities) {
        const capabilityParts = capability.toLowerCase().split('.');
        for (const part of capabilityParts) {
          if (queryLower.includes(part)) {
            score += 5;
          }
        }
      }

      // Check description
      const descWords = metadata.description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 3 && queryLower.includes(word)) {
          score += 1;
        }
      }

      if (score > 0) {
        matches.push({ id: librarianId, score });
      }
    }

    // Sort by score and return top matches
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 3).map((m) => m.id);

    return {
      librarians: topMatches,
      confidence: matches.length > 0 && matches[0] ? matches[0].score / 20 : 0,
      reasoning: `Matched based on keywords and capabilities (simple matching)`,
    };
  }

  /**
   * Get delegation suggestions for a query
   * Used by AI to understand routing options
   */
  async getSuggestions(query: string, context: Context): Promise<DelegationDecision[]> {
    // For now, return single decision
    const decision = this.analyzeQuery(query, context);
    return Promise.resolve([decision]);
  }
}

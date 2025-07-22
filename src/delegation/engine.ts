/**
 * Basic delegation engine for intelligent query routing
 * This is a simplified version that will be enhanced in Phase 4
 */

import type { SimpleRouter } from '../core/router';
import type { Context, Response } from '../types/core';
import { errorResponse } from '../types/librarian-factory';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface DelegationDecision {
  librarians: string[];
  confidence: number;
  reasoning?: string;
}

/**
 * Engine for intelligent query delegation
 * Currently implements simple keyword matching, will be enhanced with AI
 */
export class DelegationEngine {
  constructor(private router: SimpleRouter) {}

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

    // Simple routing logic for now
    const decision = this.analyzeQuery(query, context);
    
    if (decision.librarians.length === 0) {
      return errorResponse(
        'NO_MATCH',
        'No suitable librarian found for your query',
        {
          suggestion: 'Try rephrasing your question or ask for available capabilities',
        }
      );
    }

    // For now, route to the first matching librarian
    // TODO: Implement parallel routing and response aggregation
    const primaryLibrarian = decision.librarians[0];
    
    if (primaryLibrarian === undefined) {
      return errorResponse('NO_MATCH', 'No librarian selected for routing');
    }
    
    logger.info(
      { librarian: primaryLibrarian, decision },
      'Routing to librarian'
    );

    const response = await this.router.route(query, primaryLibrarian, context);
    
    // Add delegation metadata
    if (!response.error) {
      response.metadata = {
        ...response.metadata,
        delegation: {
          engine: 'basic',
          decision: decision.librarians,
          reasoning: decision.reasoning,
        },
      };
    }

    return response;
  }

  /**
   * Analyze query to determine best librarian(s)
   * TODO: Replace with AI-based analysis
   */
  private analyzeQuery(
    query: string,
    _context: Context
  ): DelegationDecision {
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
    const topMatches = matches.slice(0, 3).map(m => m.id);

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
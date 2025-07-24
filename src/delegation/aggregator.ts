/**
 * Aggregates responses from multiple librarians
 */

import type { Response } from '../types/core';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface AggregationStrategy {
  aggregate(responses: Response[]): Response;
}

/**
 * Selects the response with highest confidence
 */
export class BestConfidenceAggregator implements AggregationStrategy {
  aggregate(responses: Response[]): Response {
    if (responses.length === 0) {
      return {
        error: {
          code: 'NO_RESPONSES',
          message: 'No responses to aggregate',
        },
      };
    }

    if (responses.length === 1 && responses[0]) {
      return responses[0];
    }

    // Filter out error responses for aggregation
    const validResponses = responses.filter((r) => !r.error && r.answer);

    if (validResponses.length === 0) {
      // All responses were errors, return the first error
      return (
        responses[0] || {
          error: {
            code: 'NO_VALID_RESPONSES',
            message: 'No valid responses found',
          },
        }
      );
    }

    // Sort by confidence (highest first)
    const sorted = validResponses.sort((a, b) => {
      const confA = a.confidence ?? 0;
      const confB = b.confidence ?? 0;
      return confB - confA;
    });

    const best = sorted[0];
    if (!best) {
      return {
        error: {
          code: 'NO_BEST_RESPONSE',
          message: 'Could not determine best response',
        },
      };
    }

    const allSources = this.mergeSources(validResponses);
    const metadata = this.mergeMetadata(validResponses);

    logger.info(
      {
        selectedLibrarian: metadata.selectedLibrarian,
        confidence: best.confidence,
        totalResponses: responses.length,
        validResponses: validResponses.length,
      },
      'Aggregated responses using best confidence',
    );

    const result: Response = {
      ...best,
      metadata: {
        ...metadata,
        aggregation: {
          strategy: 'best-confidence',
          totalResponses: responses.length,
          selectedConfidence: best.confidence,
          allConfidences: validResponses.map((r) => ({
            librarian: r.metadata?.librarian,
            confidence: r.confidence ?? 0,
          })),
        },
      },
    };

    if (allSources && allSources.length > 0) {
      result.sources = allSources;
    }

    return result;
  }

  private mergeSources(responses: Response[]): Response['sources'] {
    const allSources: Response['sources'] = [];
    const seenUrls = new Set<string>();

    for (const response of responses) {
      if (response.sources) {
        for (const source of response.sources) {
          // Deduplicate by URL if available
          if (source.url && seenUrls.has(source.url)) {
            continue;
          }
          if (source.url) {
            seenUrls.add(source.url);
          }
          allSources.push(source);
        }
      }
    }

    return allSources.length > 0 ? allSources : undefined;
  }

  private mergeMetadata(responses: Response[]): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // Track which librarian's response was selected
    if (responses[0]?.metadata?.librarian) {
      metadata.selectedLibrarian = responses[0].metadata.librarian;
    }

    // Collect all librarians that responded
    metadata.respondingLibrarians = responses.map((r) => r.metadata?.librarian).filter(Boolean);

    return metadata;
  }
}

/**
 * Combines answers from multiple responses
 */
export class CombineAnswersAggregator implements AggregationStrategy {
  aggregate(responses: Response[]): Response {
    if (responses.length === 0) {
      return {
        error: {
          code: 'NO_RESPONSES',
          message: 'No responses to aggregate',
        },
      };
    }

    if (responses.length === 1 && responses[0]) {
      return responses[0];
    }

    const validResponses = responses.filter((r) => !r.error && r.answer);

    if (validResponses.length === 0) {
      return (
        responses[0] || {
          error: {
            code: 'NO_VALID_RESPONSES',
            message: 'No valid responses found',
          },
        }
      );
    }

    // Combine all answers with attribution
    const combinedParts: string[] = [];
    const allSources: Response['sources'] = [];

    for (const response of validResponses) {
      if (response.answer) {
        const librarian = response.metadata?.librarian || 'Unknown';
        combinedParts.push(`**${String(librarian)}**: ${response.answer}`);

        if (response.sources) {
          allSources.push(...response.sources);
        }
      }
    }

    const combinedAnswer = combinedParts.join('\n\n');
    const avgConfidence =
      validResponses.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / validResponses.length;

    const result: Response = {
      answer: combinedAnswer,
      confidence: avgConfidence,
      metadata: {
        aggregation: {
          strategy: 'combine-answers',
          totalResponses: responses.length,
          averageConfidence: avgConfidence,
        },
      },
    };

    if (allSources.length > 0) {
      result.sources = allSources;
    }

    return result;
  }
}

/**
 * Response aggregator with configurable strategy
 */
export class ResponseAggregator {
  constructor(private strategy: AggregationStrategy = new BestConfidenceAggregator()) {}

  /**
   * Aggregate multiple responses into a single response
   */
  aggregate(responses: Response[]): Response {
    return this.strategy.aggregate(responses);
  }
}

/**
 * Aggregates responses from multiple librarians
 */

import type { Response } from '../types/core';
import type { AIClient } from '../ai/interface';
import { getPromptLoader } from '../prompts/loader';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface AggregationStrategy {
  aggregate(
    responses: Response[],
    originalQuery?: string,
    context?: Record<string, any>,
  ): Response | Promise<Response>;
}

/**
 * Selects the response with highest confidence
 */
export class BestConfidenceAggregator implements AggregationStrategy {
  aggregate(
    responses: Response[],
    _originalQuery?: string,
    _context?: Record<string, any>,
  ): Response {
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
  aggregate(
    responses: Response[],
    _originalQuery?: string,
    _context?: Record<string, any>,
  ): Response {
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
  aggregate(
    responses: Response[],
    originalQuery?: string,
    context?: Record<string, any>,
  ): Promise<Response> {
    return Promise.resolve(this.strategy.aggregate(responses, originalQuery, context));
  }
}

/**
 * AI-powered response aggregator that intelligently combines responses
 */
export class AIAggregator implements AggregationStrategy {
  constructor(
    private aiClient: AIClient,
    private options: {
      preserveAttribution?: boolean;
      includeConfidence?: boolean;
      customPrompt?: string;
    } = {},
  ) {
    this.options.preserveAttribution = this.options.preserveAttribution ?? true;
    this.options.includeConfidence = this.options.includeConfidence ?? true;
  }

  async aggregate(
    responses: Response[],
    originalQuery?: string,
    context?: Record<string, any>,
  ): Promise<Response> {
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

    try {
      // Load and render prompt using the prompt management system
      const promptLoader = getPromptLoader();
      const template = await promptLoader.load('aggregation', 'ai-synthesis');

      // Prepare variables for the prompt
      const promptVariables: Record<string, unknown> = {
        responses: validResponses,
        ...(originalQuery && { originalQuery }),
        ...(context && { context }),
        ...(this.options.preserveAttribution && { preserveAttribution: 'true' }),
        ...(this.options.includeConfidence && { includeConfidence: 'true' }),
      };

      let prompt: string;

      if (this.options.customPrompt) {
        // Use custom prompt with placeholder replacement (legacy support)
        const responsesText = this.formatResponses(validResponses);
        prompt = this.options.customPrompt
          .replace('{{QUERY}}', originalQuery || 'Unknown query')
          .replace('{{RESPONSES}}', responsesText);
      } else {
        // Use the new prompt management system
        prompt = promptLoader.render(template, promptVariables);
      }

      const combinedAnswer = await this.aiClient.ask(prompt, {
        temperature: 0.3, // Lower temperature for more consistent aggregation
        max_tokens: 1000,
      });

      logger.debug(
        {
          promptLength: prompt.length,
          responseLength: combinedAnswer.length,
          response: combinedAnswer.substring(0, 100),
        },
        'AI aggregation response received',
      );

      // Validate AI response
      if (!combinedAnswer || combinedAnswer.trim().length === 0) {
        logger.warn('AI returned empty response, falling back to best confidence');
        const fallbackAggregator = new BestConfidenceAggregator();
        return fallbackAggregator.aggregate(responses);
      }

      // Merge all sources
      const allSources = this.mergeSources(validResponses);

      // Calculate aggregate confidence
      const avgConfidence =
        validResponses.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / validResponses.length;
      const maxConfidence = Math.max(...validResponses.map((r) => r.confidence ?? 0));

      logger.info(
        {
          totalResponses: responses.length,
          validResponses: validResponses.length,
          avgConfidence,
          maxConfidence,
        },
        'AI aggregation completed',
      );

      const result: Response = {
        answer: combinedAnswer,
        confidence: maxConfidence, // Use max confidence as the AI selected the best parts
        metadata: {
          aggregation: {
            strategy: 'ai-powered',
            totalResponses: responses.length,
            validResponses: validResponses.length,
            averageConfidence: avgConfidence,
            maxConfidence,
            contributingLibrarians: validResponses
              .map((r) => r.metadata?.librarian)
              .filter(Boolean),
            model: this.aiClient.defaultProvider.name,
          },
        },
      };

      if (allSources && allSources.length > 0) {
        result.sources = allSources;
      }

      return result;
    } catch (error) {
      logger.error({ error }, 'AI aggregation failed, falling back to best confidence');

      // Fallback to best confidence aggregation
      const fallbackAggregator = new BestConfidenceAggregator();
      return fallbackAggregator.aggregate(responses);
    }
  }

  private formatResponses(responses: Response[]): string {
    return responses
      .map((r) => {
        const librarian = r.metadata?.librarian || 'Unknown Source';
        const confidence =
          this.options.includeConfidence && r.confidence ? ` (confidence: ${r.confidence})` : '';
        return `[${String(librarian)}${confidence}]: ${r.answer}`;
      })
      .join('\n\n');
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
}

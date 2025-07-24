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
import {
  ResponseAggregator,
  BestConfidenceAggregator,
  CombineAnswersAggregator,
  AIAggregator,
} from './aggregator';
import { getAIClient } from '../ai/client';
import {
  withSpan,
  SpanAttributes,
  SpanNames,
  delegationDecisions,
  delegationChainDepth,
  parallelDelegations,
  recordResponseMetrics,
} from '../observability';
import {
  createLogger,
  createContextLogger,
  PerformanceTimer,
  logPerformance,
} from '../observability/logger';

const moduleLogger = createLogger('delegation-engine');

export interface DelegationDecision {
  librarians: string[];
  confidence: number;
  reasoning?: string;
}

export interface DelegationEngineOptions {
  aiClient?: AIClient;
  enableParallelRouting?: boolean;
  maxParallelQueries?: number;
  aggregationStrategy?: 'best-confidence' | 'combine-answers' | 'ai-powered';
  aggregationOptions?: {
    preserveAttribution?: boolean;
    includeConfidence?: boolean;
    customPrompt?: string;
  };
}

/**
 * Engine for intelligent query delegation
 * Currently implements simple keyword matching, will be enhanced with AI
 */
export class DelegationEngine {
  private aiAnalyzer?: AIQueryAnalyzer;
  private executor: DelegationExecutor;
  private aggregator: ResponseAggregator;
  private enableParallelRouting: boolean;
  private maxParallelQueries: number;
  private aggregationStrategy: string;

  constructor(
    private router: SimpleRouter,
    options: DelegationEngineOptions = {},
  ) {
    this.executor = new DelegationExecutor(router);
    this.enableParallelRouting = options.enableParallelRouting ?? false;
    this.maxParallelQueries = options.maxParallelQueries ?? 3;

    // Try to use provided AI client first, then fall back to global client
    let aiClient: AIClient | undefined;
    try {
      aiClient = options.aiClient || getAIClient();
      if (aiClient.defaultProvider.isAvailable()) {
        this.aiAnalyzer = new AIQueryAnalyzer(aiClient);
        moduleLogger.info(
          {
            aiProvider: aiClient.defaultProvider.name,
            enableParallelRouting: this.enableParallelRouting,
            maxParallelQueries: this.maxParallelQueries,
            aggregationStrategy: options.aggregationStrategy || 'best-confidence',
          },
          'Delegation engine initialized with AI support',
        );
      } else {
        moduleLogger.warn('AI provider not available, using simple routing');
      }
    } catch (error) {
      moduleLogger.warn(
        {
          err: error,
          errorCode: 'AI_INIT_FAILED',
          errorType: 'INITIALIZATION_ERROR',
          recoverable: true,
        },
        'Failed to initialize AI analyzer, using simple routing',
      );
    }

    // Initialize aggregator based on strategy
    const strategy = options.aggregationStrategy || 'best-confidence';
    this.aggregationStrategy = strategy;
    switch (strategy) {
      case 'ai-powered':
        if (!aiClient) {
          moduleLogger.warn(
            'AI aggregation requested but AI client not available, falling back to best-confidence',
          );
          this.aggregator = new ResponseAggregator(new BestConfidenceAggregator());
        } else {
          this.aggregator = new ResponseAggregator(
            new AIAggregator(aiClient, options.aggregationOptions),
          );
          moduleLogger.info(
            {
              aggregationType: 'ai-powered',
              preserveAttribution: options.aggregationOptions?.preserveAttribution ?? true,
              includeConfidence: options.aggregationOptions?.includeConfidence ?? true,
            },
            'Using AI-powered response aggregation',
          );
        }
        break;
      case 'combine-answers':
        this.aggregator = new ResponseAggregator(new CombineAnswersAggregator());
        break;
      case 'best-confidence':
      default:
        this.aggregator = new ResponseAggregator(new BestConfidenceAggregator());
        break;
    }
  }

  /**
   * Route a query to the most appropriate librarian(s)
   */
  async route(query: string, context: Context): Promise<Response> {
    const logger = createContextLogger('delegation-engine', context);
    const timer = new PerformanceTimer();

    return withSpan(SpanNames.AI_DELEGATION, async (span) => {
      span.setAttributes({
        [SpanAttributes.QUERY_TEXT]: query,
        [SpanAttributes.QUERY_USER_ID]: context.user?.id || 'anonymous',
        [SpanAttributes.DELEGATION_TYPE]: 'ai-powered',
      });

      logger.info(
        {
          queryLength: query.length,
          hasAI: !!context.ai,
          hasUser: !!context.user,
        },
        'Delegation engine routing query',
      );

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
      let analysisContext: Record<string, any> | undefined;

      if (this.aiAnalyzer && context.ai) {
        try {
          logger.debug('Using AI-powered query analysis');
          timer.mark('ai_analysis_start');
          const analysis = await this.aiAnalyzer.analyze(query, librarianInfos, context);
          timer.mark('ai_analysis_complete');
          decision = analysis.decision;
          engine = 'ai-powered';

          // Store analysis context for aggregation
          analysisContext = {
            intent: analysis.queryIntent,
            capabilities: analysis.requiredCapabilities,
            reasoning: analysis.decision.reasoning,
            candidates: analysis.candidates.length,
          };

          logger.info(
            {
              intent: analysis.queryIntent,
              capabilities: analysis.requiredCapabilities,
              candidates: analysis.candidates.length,
              analysisTimeMs: timer.getDurationBetween('ai_analysis_start', 'ai_analysis_complete'),
            },
            'AI analysis complete',
          );
        } catch (error) {
          logger.error(
            {
              err: error,
              errorCode: 'AI_ANALYSIS_FAILED',
              errorType: 'ANALYSIS_ERROR',
              recoverable: true,
            },
            'AI analysis failed, falling back to simple routing',
          );
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

      // Determine how many librarians to query
      const librariansToQuery = this.enableParallelRouting
        ? decision.librarians.slice(0, this.maxParallelQueries)
        : [decision.librarians[0]];

      // Record delegation decision metrics
      const confidenceLevel =
        decision.confidence > 0.8 ? 'high' : decision.confidence > 0.5 ? 'medium' : 'low';

      delegationDecisions.inc({
        engine,
        target_count: String(librariansToQuery.length),
        confidence_level: confidenceLevel,
      });

      // Record chain depth
      delegationChainDepth.observe(librariansToQuery.length);

      // Record parallel delegations if applicable
      if (librariansToQuery.length > 1) {
        parallelDelegations.inc({ count: String(librariansToQuery.length) });
      }

      logger.info(
        {
          targetLibrarians: librariansToQuery,
          decisionConfidence: decision.confidence,
          engine,
          parallelRouting: this.enableParallelRouting && librariansToQuery.length > 1,
          targetCount: librariansToQuery.length,
        },
        'Routing to librarian(s)',
      );

      timer.mark('execution_start');

      // Execute queries
      let response: Response;

      if (librariansToQuery.length === 1) {
        // Single librarian query
        const firstLibrarian = librariansToQuery[0];
        if (!firstLibrarian) {
          return errorResponse('NO_LIBRARIAN', 'No librarian to query');
        }
        response = await this.executor.execute(query, firstLibrarian, context);
        timer.mark('execution_complete');
      } else {
        // Parallel query to multiple librarians
        const promises = librariansToQuery
          .filter((id): id is string => id !== undefined)
          .map((librarianId) =>
            this.executor
              .execute(query, librarianId, {
                ...context,
                metadata: {
                  ...context.metadata,
                  librarian: librarianId,
                },
              })
              .catch(
                (error: Error): Response => ({
                  error: {
                    code: 'EXECUTION_ERROR',
                    message: error.message,
                    librarian: librarianId,
                  },
                }),
              ),
          );

        const responses = await Promise.all(promises);
        timer.mark('parallel_execution_complete');

        logger.info(
          {
            totalResponses: responses.length,
            successfulResponses: responses.filter((r) => !r.error).length,
            executionTimeMs: timer.getDurationBetween(
              'execution_start',
              'parallel_execution_complete',
            ),
          },
          'Received responses from multiple librarians',
        );

        timer.mark('aggregation_start');
        response = await this.aggregator.aggregate(responses, query, analysisContext);
        timer.mark('aggregation_complete');
      }

      // Add delegation metadata
      if (!response.error) {
        response.metadata = {
          ...response.metadata,
          delegation: {
            engine,
            decision: decision.librarians,
            reasoning: decision.reasoning,
            confidence: decision.confidence,
            queriedLibrarians: librariansToQuery,
            parallelRouting: this.enableParallelRouting && librariansToQuery.length > 1,
          },
        };
      }

      // Add final delegation metadata to span
      if (!response.error) {
        span.setAttributes({
          [SpanAttributes.DELEGATION_CHAIN_DEPTH]: librariansToQuery.length,
          [SpanAttributes.RESPONSE_CONFIDENCE]: response.confidence || 0,
        });

        // Record response metrics
        const aggregationStrategy =
          this.enableParallelRouting && librariansToQuery.length > 1
            ? this.aggregationStrategy || 'best-confidence'
            : 'none';
        recordResponseMetrics(response, 'delegation_engine', aggregationStrategy);
      }

      // Log final performance metrics
      logPerformance(logger, 'delegation.route', timer, {
        engine,
        targetCount: librariansToQuery.length,
        parallelRouting: this.enableParallelRouting && librariansToQuery.length > 1,
        aggregationStrategy: this.aggregationStrategy,
        responseType: response.answer ? 'answer' : response.delegate ? 'delegate' : 'error',
        confidence: response.confidence,
      });

      return response;
    });
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

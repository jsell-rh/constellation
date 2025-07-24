/**
 * AI-powered query analyzer for intelligent delegation
 * Uses LLM to understand query intent and match to librarian capabilities
 */

import type { AIClient } from '../ai/interface';
import type { Context } from '../types/core';
import type { LibrarianInfo } from '../types/core';
import type { DelegationDecision } from './engine';
import { getLibrarianRegistry } from '../registry/librarian-registry';
import { getPromptLoader } from '../prompts/loader';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export interface LibrarianCandidate {
  id: string;
  info: LibrarianInfo;
  relevanceScore: number;
  authorizationScore: number;
  totalScore: number;
  reasoning: string;
}

export interface AnalysisResult {
  queryIntent: string;
  requiredCapabilities: string[];
  candidates: LibrarianCandidate[];
  decision: DelegationDecision;
}

/**
 * AI-powered analyzer for query routing
 */
export class AIQueryAnalyzer {
  constructor(private aiClient: AIClient) {}

  /**
   * Analyze a query using AI to determine best routing
   */
  async analyze(
    query: string,
    availableLibrarians: LibrarianInfo[],
    context: Context,
  ): Promise<AnalysisResult> {
    logger.info({ query, librarianCount: availableLibrarians.length }, 'Analyzing query with AI');

    // Step 1: Understand query intent and required capabilities
    const queryAnalysis = await this.analyzeQueryIntent(query);

    // Step 2: Filter librarians by user permissions
    const authorizedLibrarians = this.filterByAuthorization(availableLibrarians, context);

    if (authorizedLibrarians.length === 0) {
      logger.warn({ userId: context.user?.id }, 'No authorized librarians for user');
      return {
        queryIntent: queryAnalysis.intent,
        requiredCapabilities: queryAnalysis.capabilities,
        candidates: [],
        decision: {
          librarians: [],
          confidence: 0,
          reasoning: 'No librarians available that user has permission to access',
        },
      };
    }

    // Step 3: Score each authorized librarian for relevance
    const candidates = await this.scoreLibrarians(
      query,
      queryAnalysis,
      authorizedLibrarians,
      context,
    );

    // Step 4: Select top candidates
    const decision = this.makeRoutingDecision(candidates, queryAnalysis);

    return {
      queryIntent: queryAnalysis.intent,
      requiredCapabilities: queryAnalysis.capabilities,
      candidates,
      decision,
    };
  }

  /**
   * Analyze query intent and extract required capabilities
   */
  private async analyzeQueryIntent(
    query: string,
  ): Promise<{ intent: string; capabilities: string[] }> {
    try {
      // Use the prompt management system
      const promptLoader = getPromptLoader();
      const template = await promptLoader.load('ai-analysis', 'query-analysis');
      const prompt = promptLoader.render(template, { query });

      const response = await this.aiClient.ask(prompt, {
        temperature: 0.3,
        max_tokens: 500,
      });

      // Try to extract JSON from the response
      // Sometimes AI may include extra text before/after JSON
      let jsonStr = response.trim();

      // Try to find JSON object in the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      try {
        const analysis = JSON.parse(jsonStr) as {
          intent: string;
          capabilities: string[];
        };

        // Validate the response structure
        if (!analysis.intent || !Array.isArray(analysis.capabilities)) {
          throw new Error('Invalid response structure');
        }

        logger.debug({ query, analysis }, 'Query intent analyzed');
        return analysis;
      } catch (parseError) {
        logger.warn({ response, parseError }, 'Failed to parse AI response as JSON');

        // Try to extract intent from plain text response
        const intent = response.includes('security')
          ? 'Security analysis'
          : response.includes('code')
            ? 'Code analysis'
            : 'General query';

        return {
          intent,
          capabilities: [],
        };
      }
    } catch (error) {
      logger.error({ error, query }, 'Failed to analyze query intent');
      // Fallback to simple analysis
      return {
        intent: 'General query',
        capabilities: [],
      };
    }
  }

  /**
   * Filter librarians by user authorization
   */
  private filterByAuthorization(librarians: LibrarianInfo[], context: Context): LibrarianInfo[] {
    const registry = getLibrarianRegistry();

    return librarians.filter((librarian) => {
      const entry = registry.getEntry(librarian.id);
      if (!entry) return false;

      // Public librarians are always accessible
      if (entry.permissions?.public) return true;

      // No user context means no access to non-public librarians
      if (!context.user) return false;

      // Check team ownership
      if (context.user.teams?.includes(entry.team)) return true;

      // Check allowed teams
      if (entry.permissions?.allowedTeams) {
        const hasTeamAccess = entry.permissions.allowedTeams.some(
          (team) => context.user!.teams?.includes(team),
        );
        if (hasTeamAccess) return true;
      }

      // Check allowed roles
      if (entry.permissions?.allowedRoles) {
        const hasRoleAccess = entry.permissions.allowedRoles.some(
          (role) => context.user!.roles?.includes(role),
        );
        if (hasRoleAccess) return true;
      }

      return false;
    });
  }

  /**
   * Score librarians based on relevance to query
   */
  private async scoreLibrarians(
    query: string,
    queryAnalysis: { intent: string; capabilities: string[] },
    librarians: LibrarianInfo[],
    context: Context,
  ): Promise<LibrarianCandidate[]> {
    const candidates: LibrarianCandidate[] = [];

    // Use AI to score each librarian
    const scoringPromises = librarians.map(async (librarian) => {
      const relevanceScore = await this.scoreRelevance(query, queryAnalysis, librarian);
      const authorizationScore = this.scoreAuthorization(librarian, context);

      candidates.push({
        id: librarian.id,
        info: librarian,
        relevanceScore,
        authorizationScore,
        totalScore: relevanceScore * 0.8 + authorizationScore * 0.2,
        reasoning: this.generateReasoning(librarian, relevanceScore, authorizationScore),
      });
    });

    await Promise.all(scoringPromises);

    // Sort by total score
    candidates.sort((a, b) => b.totalScore - a.totalScore);

    return candidates;
  }

  /**
   * Score relevance of a librarian to the query
   */
  private async scoreRelevance(
    query: string,
    _queryAnalysis: { intent: string; capabilities: string[] },
    librarian: LibrarianInfo,
  ): Promise<number> {
    try {
      // Use the prompt management system
      const promptLoader = getPromptLoader();
      const template = await promptLoader.load('ai-analysis', 'librarian-relevance');
      const prompt = promptLoader.render(template, {
        query,
        librarian: {
          name: librarian.name,
          description: librarian.description,
          capabilities: librarian.capabilities,
          team: librarian.team,
        },
      });

      const response = await this.aiClient.ask(prompt, {
        temperature: 0.2,
        max_tokens: 100,
      });

      const score = parseInt(response.trim(), 10);
      return isNaN(score) ? 0 : Math.min(100, Math.max(0, score));
    } catch (error) {
      logger.error({ error, librarian: librarian.id }, 'Failed to score relevance');
      // Fallback to simple keyword matching
      return this.fallbackScoring(query, librarian);
    }
  }

  /**
   * Score authorization level (how directly authorized the user is)
   */
  private scoreAuthorization(librarian: LibrarianInfo, context: Context): number {
    const registry = getLibrarianRegistry();
    const entry = registry.getEntry(librarian.id);
    if (!entry) return 0;

    // Public librarians get base score
    if (entry.permissions?.public) return 50;

    // No user means no score
    if (!context.user) return 0;

    // Team owner gets highest score
    if (context.user.teams?.includes(entry.team)) return 100;

    // Explicitly allowed teams get high score
    if (entry.permissions?.allowedTeams?.some((team) => context.user!.teams?.includes(team))) {
      return 80;
    }

    // Role-based access gets moderate score
    if (entry.permissions?.allowedRoles?.some((role) => context.user!.roles?.includes(role))) {
      return 60;
    }

    return 0;
  }

  /**
   * Generate human-readable reasoning for the scoring
   */
  private generateReasoning(
    _librarian: LibrarianInfo,
    relevanceScore: number,
    authorizationScore: number,
  ): string {
    const reasons: string[] = [];

    if (relevanceScore >= 80) {
      reasons.push(`Highly relevant to query (${relevanceScore}% match)`);
    } else if (relevanceScore >= 50) {
      reasons.push(`Moderately relevant to query (${relevanceScore}% match)`);
    } else {
      reasons.push(`Limited relevance to query (${relevanceScore}% match)`);
    }

    if (authorizationScore === 100) {
      reasons.push('User is team owner');
    } else if (authorizationScore >= 80) {
      reasons.push('User has explicit team access');
    } else if (authorizationScore >= 60) {
      reasons.push('User has role-based access');
    } else if (authorizationScore === 50) {
      reasons.push('Public librarian');
    }

    return reasons.join('. ');
  }

  /**
   * Make final routing decision based on scored candidates
   */
  private makeRoutingDecision(
    candidates: LibrarianCandidate[],
    queryAnalysis: { intent: string; capabilities: string[] },
  ): DelegationDecision {
    if (candidates.length === 0) {
      return {
        librarians: [],
        confidence: 0,
        reasoning: 'No suitable librarians found',
      };
    }

    // Select librarians with score above threshold
    const threshold = 40;
    const selected = candidates.filter((c) => c.totalScore >= threshold);

    if (selected.length === 0 && candidates.length > 0) {
      // If no one meets threshold, take the best one
      const firstCandidate = candidates[0];
      if (firstCandidate) {
        selected.push(firstCandidate);
      }
    }

    // Take top 3 candidates max
    const topCandidates = selected.slice(0, 3);

    if (topCandidates.length === 0) {
      return {
        librarians: [],
        confidence: 0,
        reasoning: `AI routing based on intent: "${queryAnalysis.intent}". No suitable candidates found.`,
      };
    }

    const topCandidate = topCandidates[0];
    if (!topCandidate) {
      // This should never happen due to the check above, but TypeScript needs assurance
      return {
        librarians: [],
        confidence: 0,
        reasoning: `AI routing based on intent: "${queryAnalysis.intent}". No suitable candidates found.`,
      };
    }

    return {
      librarians: topCandidates.map((c) => c.id),
      confidence: topCandidate.totalScore / 100,
      reasoning: `AI routing based on intent: "${queryAnalysis.intent}". ${topCandidate.reasoning}`,
    };
  }

  /**
   * Fallback scoring using simple keyword matching
   */
  private fallbackScoring(query: string, librarian: LibrarianInfo): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Check name
    if (queryLower.includes(librarian.name.toLowerCase())) {
      score += 30;
    }

    // Check capabilities
    for (const capability of librarian.capabilities) {
      const parts = capability.toLowerCase().split('.');
      for (const part of parts) {
        if (queryLower.includes(part)) {
          score += 20;
        }
      }
    }

    // Check description words
    const descWords = librarian.description.toLowerCase().split(/\s+/);
    for (const word of descWords) {
      if (word.length > 3 && queryLower.includes(word)) {
        score += 5;
      }
    }

    return Math.min(100, score);
  }
}

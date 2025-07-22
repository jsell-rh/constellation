/**
 * Delegation Interfaces
 * 
 * Defines how AI-driven delegation works in the system.
 */

import { LibrarianInfo, Response } from './librarian';

/**
 * AI delegation engine interface
 */
export interface DelegationEngine {
  /**
   * Analyze a query to determine routing
   */
  analyzeQuery(
    query: string,
    availableLibrarians: LibrarianInfo[]
  ): Promise<QueryAnalysis>;
  
  /**
   * Decide if delegation is needed
   */
  shouldDelegate(
    query: string,
    currentCapabilities: string[],
    availableDelegates: LibrarianInfo[],
    currentConfidence: number
  ): Promise<DelegationDecision>;
  
  /**
   * Select best delegates for a query
   */
  selectDelegates(
    query: string,
    candidates: LibrarianInfo[],
    maxDelegates?: number
  ): Promise<SelectedDelegate[]>;
  
  /**
   * Merge multiple responses intelligently
   */
  mergeResponses(
    original: Response,
    delegated: Response[]
  ): Promise<Response>;
}

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  // What the user wants to know
  intent: string;
  
  // Domains involved in the query
  domains: string[];
  
  // Query complexity
  complexity: 'simple' | 'moderate' | 'complex';
  
  // Is this multi-domain?
  isMultiDomain: boolean;
  
  // Urgency level
  urgency: 'normal' | 'high' | 'critical';
  
  // Suggested librarians with scores
  suggestedLibrarians: SuggestedLibrarian[];
  
  // Keywords extracted
  keywords: string[];
  
  // Confidence in analysis
  analysisConfidence: number;
}

/**
 * Suggested librarian from analysis
 */
export interface SuggestedLibrarian {
  id: string;
  relevanceScore: number;
  reason: string;
  capabilities: string[];
}

/**
 * Delegation decision
 */
export interface DelegationDecision {
  // Should we delegate?
  shouldDelegate: boolean;
  
  // Why this decision?
  reasoning: string;
  
  // How to delegate
  strategy: 'none' | 'single' | 'multiple' | 'broadcast';
  
  // Suggested delegates
  suggestedDelegates: string[];
  
  // Refined queries for each delegate
  refinedQueries?: Record<string, string>;
  
  // Expected improvement
  expectedImprovement?: number;
}

/**
 * Selected delegate with context
 */
export interface SelectedDelegate {
  id: string;
  score: number;
  reason: string;
  refinedQuery?: string;
  expectedResponseTime?: number;
}

/**
 * Delegation metrics for monitoring
 */
export interface DelegationMetrics {
  totalDelegations: number;
  successfulDelegations: number;
  failedDelegations: number;
  averageDelegationDepth: number;
  delegationPatterns: DelegationPattern[];
}

/**
 * Common delegation patterns
 */
export interface DelegationPattern {
  from: string;
  to: string;
  frequency: number;
  averageConfidenceImprovement: number;
  typicalQueries: string[];
}
/**
 * Tests for AI-powered query analyzer
 */

import { AIQueryAnalyzer } from '../../../src/delegation/ai-analyzer';
import type { AIClient } from '../../../src/ai/interface';
import type { Context, LibrarianInfo } from '../../../src/types/core';

// Mock AI client
const createMockAIClient = (mockResponses: Record<string, string> = {}): AIClient => {
  const defaultResponse = JSON.stringify({
    intent: 'General query',
    capabilities: [],
  });

  return {
    ask: jest.fn((prompt: string) => {
      // Match different prompt types
      if (prompt.includes('Analyze this query')) {
        return Promise.resolve(mockResponses.queryIntent || defaultResponse);
      }
      if (prompt.includes('Score how well')) {
        return Promise.resolve(mockResponses.relevanceScore || '50');
      }
      return Promise.resolve(defaultResponse);
    }),
    complete: jest.fn(),
    stream: jest.fn(),
    defaultProvider: {
      name: 'mock',
      isAvailable: () => true,
      getSupportedModels: () => ['mock-model'],
      complete: jest.fn(),
      stream: jest.fn(),
      ask: jest.fn(),
    },
    providers: {},
    completeWith: jest.fn(),
    streamWith: jest.fn(),
    askWith: jest.fn(),
  } as unknown as AIClient;
};

// Mock librarian registry
jest.mock('../../../src/registry/librarian-registry', () => ({
  getLibrarianRegistry: jest.fn(() => ({
    getEntry: jest.fn((id: string) => {
      const entries: Record<string, unknown> = {
        'kubernetes-ops': {
          id: 'kubernetes-ops',
          team: 'platform',
          permissions: { public: false, allowedTeams: ['platform', 'devops'] },
        },
        'hr-assistant': {
          id: 'hr-assistant',
          team: 'hr',
          permissions: { allowedRoles: ['hr-staff', 'manager'] },
        },
        'wiki-search': {
          id: 'wiki-search',
          team: 'it',
          permissions: { public: true },
        },
        'finance-reports': {
          id: 'finance-reports',
          team: 'finance',
          permissions: { allowedTeams: ['finance'], sensitiveData: true },
        },
      };
      return entries[id];
    }),
  })),
}));

describe('AIQueryAnalyzer', () => {
  const mockLibrarians: LibrarianInfo[] = [
    {
      id: 'kubernetes-ops',
      name: 'Kubernetes Operations',
      description: 'Manages Kubernetes clusters and deployments',
      capabilities: ['kubernetes.operations', 'deployment.management'],
      team: 'platform',
    },
    {
      id: 'hr-assistant',
      name: 'HR Assistant',
      description: 'Helps with HR policies and employee questions',
      capabilities: ['hr.policies', 'employee.benefits'],
      team: 'hr',
    },
    {
      id: 'wiki-search',
      name: 'Wiki Search',
      description: 'Searches company wiki and documentation',
      capabilities: ['search.wiki', 'documentation.retrieval'],
      team: 'it',
    },
    {
      id: 'finance-reports',
      name: 'Finance Reports',
      description: 'Generates financial reports and analytics',
      capabilities: ['finance.reporting', 'analytics.financial'],
      team: 'finance',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyze', () => {
    it('should analyze query and return candidates based on relevance and permissions', async () => {
      const mockAIClient = createMockAIClient({
        queryIntent: JSON.stringify({
          intent: 'Deploy application to Kubernetes',
          capabilities: ['kubernetes.operations', 'deployment.management'],
        }),
        relevanceScore: '95',
      });

      const analyzer = new AIQueryAnalyzer(mockAIClient);
      const context: Context = {
        user: {
          id: 'user123',
          teams: ['platform'],
          roles: ['developer'],
        },
      };

      const result = await analyzer.analyze(
        'How do I deploy my app to production Kubernetes?',
        mockLibrarians,
        context,
      );

      expect(result.queryIntent).toBe('Deploy application to Kubernetes');
      expect(result.requiredCapabilities).toContain('kubernetes.operations');
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.decision.librarians).toContain('kubernetes-ops');
      expect(result.decision.confidence).toBeGreaterThan(0.1);
    });

    it('should filter out librarians user does not have access to', async () => {
      const mockAIClient = createMockAIClient({
        queryIntent: JSON.stringify({
          intent: 'Get financial reports',
          capabilities: ['finance.reporting'],
        }),
      });

      const analyzer = new AIQueryAnalyzer(mockAIClient);
      const context: Context = {
        user: {
          id: 'user123',
          teams: ['engineering'],
          roles: ['developer'],
        },
      };

      const result = await analyzer.analyze(
        'Show me the quarterly financial reports',
        mockLibrarians,
        context,
      );

      // Should only include public librarians (wiki-search)
      const authorizedIds = result.candidates.map((c) => c.id);
      expect(authorizedIds).toContain('wiki-search');
      expect(authorizedIds).not.toContain('finance-reports');
      expect(authorizedIds).not.toContain('kubernetes-ops');
      expect(authorizedIds).not.toContain('hr-assistant');
    });

    it('should return no candidates when user has no access', async () => {
      const mockAIClient = createMockAIClient();
      const analyzer = new AIQueryAnalyzer(mockAIClient);
      const context: Context = {
        // No user context
      };

      const nonPublicLibrarians = mockLibrarians.filter((l) => l.id !== 'wiki-search');

      const result = await analyzer.analyze('Any query', nonPublicLibrarians, context);

      expect(result.candidates).toHaveLength(0);
      expect(result.decision.librarians).toHaveLength(0);
      expect(result.decision.reasoning).toContain('No librarians available');
    });

    it('should handle AI failures gracefully', async () => {
      const mockAIClient = createMockAIClient();
      (mockAIClient.ask as jest.Mock).mockRejectedValueOnce(new Error('AI service error'));

      const analyzer = new AIQueryAnalyzer(mockAIClient);
      const context: Context = {
        user: {
          id: 'user123',
          teams: ['it'],
        },
      };

      const result = await analyzer.analyze('Search for documentation', mockLibrarians, context);

      // Should fall back to simple analysis
      expect(result.queryIntent).toBe('General query');
      expect(result.requiredCapabilities).toHaveLength(0);
      // Should still filter by permissions
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should rank candidates by combined relevance and authorization scores', async () => {
      const mockAIClient = createMockAIClient();
      // Mock different relevance scores
      (mockAIClient.ask as jest.Mock).mockImplementation((prompt: string) => {
        if (prompt.includes('Analyze this query')) {
          return Promise.resolve(
            JSON.stringify({
              intent: 'Search for information',
              capabilities: ['search'],
            }),
          );
        }
        if (prompt.includes('Wiki Search')) return Promise.resolve('80');
        if (prompt.includes('HR Assistant')) return Promise.resolve('20');
        if (prompt.includes('Kubernetes')) return Promise.resolve('10');
        return Promise.resolve('50');
      });

      const analyzer = new AIQueryAnalyzer(mockAIClient);
      const context: Context = {
        user: {
          id: 'user123',
          teams: ['platform', 'hr'],
          roles: ['developer', 'hr-staff'],
        },
      };

      const result = await analyzer.analyze('Search for vacation policy', mockLibrarians, context);

      // Wiki should rank highest (high relevance + public access)
      expect(result.candidates[0]?.id).toBe('wiki-search');
      // HR should be second despite lower relevance (user has role access)
      const hrCandidate = result.candidates.find((c) => c.id === 'hr-assistant');
      expect(hrCandidate).toBeDefined();
      expect(hrCandidate?.authorizationScore).toBeGreaterThan(50);
    });

    it('should use fallback scoring when AI relevance scoring fails', async () => {
      const mockAIClient = createMockAIClient();
      let callCount = 0;
      (mockAIClient.ask as jest.Mock).mockImplementation((prompt: string) => {
        if (prompt.includes('Analyze this query')) {
          return Promise.resolve(
            JSON.stringify({
              intent: 'Search wiki',
              capabilities: ['search.wiki'],
            }),
          );
        }
        // Fail relevance scoring on first librarian only
        if (prompt.includes('Score how well') && callCount++ === 0) {
          return Promise.reject(new Error('AI error'));
        }
        return Promise.resolve('70');
      });

      const analyzer = new AIQueryAnalyzer(mockAIClient);
      const context: Context = {
        user: {
          id: 'user123',
          teams: ['it'],
        },
      };

      const result = await analyzer.analyze(
        'search wiki for deployment docs',
        mockLibrarians,
        context,
      );

      // Should still return results using fallback scoring
      expect(result.candidates.length).toBeGreaterThan(0);
      const wikiCandidate = result.candidates.find((c) => c.id === 'wiki-search');
      expect(wikiCandidate).toBeDefined();
      // Fallback scoring should match on "wiki" keyword
      expect(wikiCandidate!.relevanceScore).toBeGreaterThan(0);
    });

    it('should respect team ownership for authorization scoring', async () => {
      const mockAIClient = createMockAIClient();
      const analyzer = new AIQueryAnalyzer(mockAIClient);

      const context: Context = {
        user: {
          id: 'user123',
          teams: ['finance'], // User owns finance team
        },
      };

      const result = await analyzer.analyze('Generate financial report', mockLibrarians, context);

      const financeCandidate = result.candidates.find((c) => c.id === 'finance-reports');
      expect(financeCandidate).toBeDefined();
      expect(financeCandidate!.authorizationScore).toBe(100); // Team owner gets highest score
      expect(financeCandidate!.reasoning).toContain('team owner');
    });
  });

  describe('edge cases', () => {
    it('should handle empty librarian list', async () => {
      const mockAIClient = createMockAIClient();
      const analyzer = new AIQueryAnalyzer(mockAIClient);
      const context: Context = { user: { id: 'user123' } };

      const result = await analyzer.analyze('Any query', [], context);

      expect(result.candidates).toHaveLength(0);
      expect(result.decision.librarians).toHaveLength(0);
    });

    it('should handle malformed AI responses', async () => {
      const mockAIClient = createMockAIClient({
        queryIntent: 'not valid json',
      });

      const analyzer = new AIQueryAnalyzer(mockAIClient);
      const context: Context = { user: { id: 'user123', teams: ['it'] } };

      const result = await analyzer.analyze('Search docs', mockLibrarians, context);

      // Should fall back gracefully
      expect(result.queryIntent).toBe('General query');
      expect(result.candidates.length).toBeGreaterThan(0);
    });

    it('should handle invalid relevance scores', async () => {
      const mockAIClient = createMockAIClient({
        relevanceScore: 'not a number',
      });

      const analyzer = new AIQueryAnalyzer(mockAIClient);
      const context: Context = { user: { id: 'user123', teams: ['it'] } };

      const result = await analyzer.analyze('Search', mockLibrarians, context);

      // Should default to 0 for invalid scores
      const candidate = result.candidates.find((c) => c.id === 'wiki-search');
      expect(candidate).toBeDefined();
      expect(candidate!.relevanceScore).toBe(0);
    });
  });
});

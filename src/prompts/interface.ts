/**
 * Prompt management system for consistent, version-controlled AI prompts
 */

export interface PromptMetadata {
  name: string;
  version: string;
  description: string;
  variables: Array<{
    name: string;
    description: string;
    required?: boolean;
    type?: 'string' | 'object' | 'array';
  }>;
  examples?: Array<{
    query?: string;
    variables?: Record<string, unknown>;
    expectedOutput?: string;
  }>;
}

export interface PromptTemplate {
  metadata: PromptMetadata;
  template: string;
}

export interface PromptVariables {
  [key: string]: unknown;
}

export interface BasePromptVariables extends PromptVariables {
  // Base interface for all prompt variables
}

export interface PromptLoader {
  /**
   * Load a prompt template by category and name
   */
  load(category: string, name: string): Promise<PromptTemplate>;

  /**
   * Render a prompt with variables
   */
  render(template: PromptTemplate, variables: PromptVariables): string;

  /**
   * List available prompts
   */
  list(): Promise<Array<{ category: string; name: string; metadata: PromptMetadata }>>;

  /**
   * Validate that all required variables are provided
   */
  validate(template: PromptTemplate, variables: PromptVariables): string[];
}

/**
 * Strongly typed prompt interfaces for different use cases
 */
export interface AIAnalysisVariables {
  query: string;
  librarians: Array<{
    id: string;
    name: string;
    description: string;
    capabilities: string[];
  }>;
  userContext?: {
    teams?: string[];
    roles?: string[];
  };
}

export interface AggregationVariables extends BasePromptVariables {
  originalQuery?: string | undefined;
  responses: Array<{
    answer?: string;
    confidence?: number;
    metadata?: { librarian?: string };
    sources?: Array<{ name: string; url?: string }>;
  }>;
  context?:
    | {
        intent?: string;
        capabilities?: string[];
        reasoning?: string;
      }
    | undefined;
}

export interface DelegationVariables {
  query: string;
  fromLibrarian: string;
  toLibrarian: string;
  reason?: string;
  context?: Record<string, unknown>;
}

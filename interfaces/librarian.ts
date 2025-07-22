/**
 * Core Librarian Interfaces
 * 
 * These are the fundamental types that define how librarians work.
 * Every librarian must implement these interfaces.
 */

/**
 * The core librarian function type.
 * A librarian is simply an async function that takes a query and returns a response.
 */
export type Librarian = (
  query: string,
  context?: Context
) => Promise<Response>;

/**
 * Context provided to every librarian.
 * Contains identity, tracing, AI access, and delegation information.
 */
export interface Context {
  // Identity and metadata
  librarian?: LibrarianInfo;
  user?: User;
  
  // Tracing and observability
  trace?: TraceContext;
  delegationChain?: string[];
  
  // AI and delegation capabilities
  ai?: AIClient;
  availableDelegates?: Delegate[];
  
  // Additional metadata
  metadata?: Record<string, any>;
}

/**
 * Response from a librarian.
 * Can include an answer, delegation request, or error.
 */
export interface Response {
  // Direct answer to the query
  answer?: string;
  
  // Sources used to generate the answer
  sources?: Source[];
  
  // Request to delegate to another librarian
  delegate?: DelegateRequest | DelegateRequest[];
  
  // Confidence in the answer (0-1)
  confidence?: number;
  
  // Error information if something went wrong
  error?: ErrorInfo;
  
  // Indicates if this is a partial answer
  partial?: boolean;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

/**
 * Information about a librarian
 */
export interface LibrarianInfo {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  team?: string;
  endpoint?: string;
}

/**
 * User information
 */
export interface User {
  id: string;
  email?: string;
  teams?: string[];
  roles?: string[];
}

/**
 * Trace context for distributed tracing
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  attributes?: Record<string, any>;
}

/**
 * AI client interface for intelligent operations
 */
export interface AIClient {
  /**
   * Complete a prompt and return the response
   */
  complete(prompt: string, options?: AIOptions): Promise<string>;
  
  /**
   * Analyze text and return structured data
   */
  analyze(text: string, schema: any): Promise<any>;
  
  /**
   * Embed text for semantic search
   */
  embed?(text: string): Promise<number[]>;
}

/**
 * Options for AI operations
 */
export interface AIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

/**
 * Information about an available delegate
 */
export interface Delegate {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  endpoint: string;
  sla?: {
    responseTime?: number;
    availability?: number;
  };
}

/**
 * Request to delegate to another librarian
 */
export interface DelegateRequest {
  // ID of the target librarian
  to: string;
  
  // Optionally refine the query for the delegate
  query?: string;
  
  // Additional context to pass
  context?: Record<string, any>;
  
  // Fallback if primary delegate fails
  fallback?: string;
}

/**
 * Source of information used in answer
 */
export interface Source {
  name: string;
  url?: string;
  type?: 'document' | 'api' | 'database' | 'cache';
  relevance?: number;
  timestamp?: number;
}

/**
 * Error information
 */
export interface ErrorInfo {
  code: string;
  message: string;
  librarian?: string;
  query?: string;
  recoverable?: boolean;
  suggestion?: string;
  details?: Record<string, any>;
}
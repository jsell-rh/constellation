/**
 * AI Provider Interface for Constellation
 * Provides a unified interface for different AI providers (OpenAI, Anthropic, Vertex AI)
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  finish_reason?: string;
}

export interface AIStreamResponse extends AsyncIterable<string> {
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

export interface AICompletionOptions {
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Temperature (0-1, higher = more creative) */
  temperature?: number;
  /** Stop sequences */
  stop?: string[];
  /** Whether to stream the response */
  stream?: boolean;
  /** System prompt */
  system?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface AIProvider {
  /** Provider name (e.g., 'openai', 'anthropic', 'vertex-ai') */
  name: string;
  
  /** Complete a chat conversation */
  complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AIResponse>;
  
  /** Stream a chat conversation */
  stream(messages: AIMessage[], options?: AICompletionOptions): Promise<AIStreamResponse>;
  
  /** Simple text completion helper */
  ask(prompt: string, options?: AICompletionOptions): Promise<string>;
  
  /** Check if provider is available/configured */
  isAvailable(): boolean;
  
  /** Get supported models */
  getSupportedModels(): string[];
}

export interface AIClient {
  /** Default provider */
  defaultProvider: AIProvider;
  
  /** All available providers */
  providers: Record<string, AIProvider>;
  
  /** Complete using default provider */
  complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AIResponse>;
  
  /** Stream using default provider */
  stream(messages: AIMessage[], options?: AICompletionOptions): Promise<AIStreamResponse>;
  
  /** Simple ask using default provider */
  ask(prompt: string, options?: AICompletionOptions): Promise<string>;
  
  /** Complete using specific provider */
  completeWith(provider: string, messages: AIMessage[], options?: AICompletionOptions): Promise<AIResponse>;
  
  /** Stream using specific provider */
  streamWith(provider: string, messages: AIMessage[], options?: AICompletionOptions): Promise<AIStreamResponse>;
  
  /** Ask using specific provider */
  askWith(provider: string, prompt: string, options?: AICompletionOptions): Promise<string>;
}

export interface AIConfiguration {
  /** Default provider to use */
  defaultProvider: 'openai' | 'anthropic' | 'vertex-ai';
  
  /** OpenAI configuration */
  openai?: {
    apiKey: string;
    model?: string;
    baseURL?: string;
  };
  
  /** Anthropic configuration */
  anthropic?: {
    apiKey: string;
    model?: string;
  };
  
  /** Google Vertex AI configuration */
  vertexAI?: {
    projectId: string;
    location: string;
    model?: string;
    credentials?: string; // Path to service account key file
  };
  
  /** Global defaults */
  defaults?: {
    temperature?: number;
    max_tokens?: number;
    timeout?: number;
  };
}
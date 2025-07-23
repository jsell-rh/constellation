/**
 * AI Client implementation that manages multiple providers
 */

import type { 
  AIClient, 
  AIProvider, 
  AIConfiguration, 
  AIMessage, 
  AIResponse, 
  AIStreamResponse, 
  AICompletionOptions 
} from './interface';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { VertexAIProvider } from './providers/vertex-ai';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export class ConstellationAIClient implements AIClient {
  public defaultProvider: AIProvider;
  public providers: Record<string, AIProvider> = {};
  private config: AIConfiguration;

  constructor(config: AIConfiguration) {
    this.config = config;
    this.initializeProviders();
    
    const defaultProviderInstance = this.providers[config.defaultProvider];
    if (!defaultProviderInstance) {
      throw new Error(`Default provider '${config.defaultProvider}' not configured or unavailable`);
    }
    
    this.defaultProvider = defaultProviderInstance;
    
    logger.info({
      defaultProvider: config.defaultProvider,
      availableProviders: Object.keys(this.providers),
    }, 'AI Client initialized');
  }

  private initializeProviders(): void {
    // Initialize OpenAI if configured
    if (this.config.openai?.apiKey) {
      try {
        const provider = new OpenAIProvider({
          apiKey: this.config.openai.apiKey,
          ...(this.config.openai.model && { model: this.config.openai.model }),
          ...(this.config.openai.baseURL && { baseURL: this.config.openai.baseURL }),
          ...(this.config.defaults?.temperature !== undefined && { temperature: this.config.defaults.temperature }),
          ...(this.config.defaults?.max_tokens !== undefined && { maxTokens: this.config.defaults.max_tokens }),
        });
        
        if (provider.isAvailable()) {
          this.providers.openai = provider;
          logger.debug('OpenAI provider initialized');
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to initialize OpenAI provider');
      }
    }

    // Initialize Anthropic if configured
    if (this.config.anthropic?.apiKey) {
      try {
        const provider = new AnthropicProvider({
          apiKey: this.config.anthropic.apiKey,
          ...(this.config.anthropic.model && { model: this.config.anthropic.model }),
          ...(this.config.defaults?.temperature !== undefined && { temperature: this.config.defaults.temperature }),
          ...(this.config.defaults?.max_tokens !== undefined && { maxTokens: this.config.defaults.max_tokens }),
        });
        
        if (provider.isAvailable()) {
          this.providers.anthropic = provider;
          logger.debug('Anthropic provider initialized');
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to initialize Anthropic provider');
      }
    }

    // Initialize Vertex AI if configured
    if (this.config.vertexAI?.projectId) {
      try {
        const provider = new VertexAIProvider({
          projectId: this.config.vertexAI.projectId,
          location: this.config.vertexAI.location,
          ...(this.config.vertexAI.model && { model: this.config.vertexAI.model }),
          ...(this.config.vertexAI.credentials && { credentials: this.config.vertexAI.credentials }),
          ...(this.config.defaults?.temperature !== undefined && { temperature: this.config.defaults.temperature }),
          ...(this.config.defaults?.max_tokens !== undefined && { maxTokens: this.config.defaults.max_tokens }),
        });
        
        if (provider.isAvailable()) {
          this.providers['vertex-ai'] = provider;
          logger.debug('Vertex AI provider initialized');
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to initialize Vertex AI provider');
      }
    }

    if (Object.keys(this.providers).length === 0) {
      throw new Error('No AI providers could be initialized. Please check your configuration.');
    }
  }

  async complete(messages: AIMessage[], options: AICompletionOptions = {}): Promise<AIResponse> {
    const finalOptions = this.mergeOptions(options);
    return this.defaultProvider.complete(messages, finalOptions);
  }

  async stream(messages: AIMessage[], options: AICompletionOptions = {}): Promise<AIStreamResponse> {
    const finalOptions = this.mergeOptions(options);
    return this.defaultProvider.stream(messages, finalOptions);
  }

  async ask(prompt: string, options: AICompletionOptions = {}): Promise<string> {
    const finalOptions = this.mergeOptions(options);
    return this.defaultProvider.ask(prompt, finalOptions);
  }

  async completeWith(provider: string, messages: AIMessage[], options: AICompletionOptions = {}): Promise<AIResponse> {
    const providerInstance = this.getProvider(provider);
    const finalOptions = this.mergeOptions(options);
    return providerInstance.complete(messages, finalOptions);
  }

  async streamWith(provider: string, messages: AIMessage[], options: AICompletionOptions = {}): Promise<AIStreamResponse> {
    const providerInstance = this.getProvider(provider);
    const finalOptions = this.mergeOptions(options);
    return providerInstance.stream(messages, finalOptions);
  }

  async askWith(provider: string, prompt: string, options: AICompletionOptions = {}): Promise<string> {
    const providerInstance = this.getProvider(provider);
    const finalOptions = this.mergeOptions(options);
    return providerInstance.ask(prompt, finalOptions);
  }

  /**
   * Get all available provider names
   */
  getAvailableProviders(): string[] {
    return Object.keys(this.providers);
  }

  /**
   * Get supported models for a specific provider
   */
  getSupportedModels(provider?: string): string[] {
    const providerName = provider || this.defaultProvider.name;
    const providerInstance = this.getProvider(providerName);
    return providerInstance.getSupportedModels();
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: string): boolean {
    return Boolean(this.providers[provider]?.isAvailable());
  }

  /**
   * Get provider instance by name
   */
  private getProvider(provider: string): AIProvider {
    const providerInstance = this.providers[provider];
    if (!providerInstance) {
      throw new Error(`Provider '${provider}' not found. Available providers: ${Object.keys(this.providers).join(', ')}`);
    }
    return providerInstance;
  }

  /**
   * Merge default options with provided options
   */
  private mergeOptions(options: AICompletionOptions): AICompletionOptions {
    return {
      ...(this.config.defaults?.temperature !== undefined && { temperature: this.config.defaults.temperature }),
      ...(this.config.defaults?.max_tokens !== undefined && { max_tokens: this.config.defaults.max_tokens }),
      ...(this.config.defaults?.timeout !== undefined && { timeout: this.config.defaults.timeout }),
      ...options,
    };
  }
}

/**
 * Factory function to create AI client from environment variables
 */
export function createAIClientFromEnv(): ConstellationAIClient {
  const config: AIConfiguration = {
    defaultProvider: (process.env.AI_DEFAULT_PROVIDER as any) ?? 'openai',
  };

  // OpenAI configuration
  if (process.env.OPENAI_API_KEY) {
    config.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      ...(process.env.OPENAI_MODEL && { model: process.env.OPENAI_MODEL }),
      ...(process.env.OPENAI_BASE_URL && { baseURL: process.env.OPENAI_BASE_URL }),
    };
  }

  // Anthropic configuration
  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(process.env.ANTHROPIC_MODEL && { model: process.env.ANTHROPIC_MODEL }),
    };
  }

  // Vertex AI configuration
  if (process.env.GOOGLE_PROJECT_ID) {
    config.vertexAI = {
      projectId: process.env.GOOGLE_PROJECT_ID,
      location: process.env.GOOGLE_LOCATION ?? 'us-central1',
      ...(process.env.GOOGLE_MODEL && { model: process.env.GOOGLE_MODEL }),
      ...(process.env.GOOGLE_APPLICATION_CREDENTIALS && { credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS }),
    };
  }

  // Global defaults
  config.defaults = {
    temperature: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : 0.7,
    max_tokens: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS) : 2048,
    timeout: process.env.AI_TIMEOUT ? parseInt(process.env.AI_TIMEOUT) : 30000,
  };

  return new ConstellationAIClient(config);
}

/**
 * Singleton AI client instance (lazy initialized)
 */
let globalAIClient: ConstellationAIClient | null = null;

/**
 * Get the global AI client instance
 */
export function getAIClient(): ConstellationAIClient {
  if (!globalAIClient) {
    globalAIClient = createAIClientFromEnv();
  }
  return globalAIClient;
}
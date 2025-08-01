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
  AICompletionOptions,
} from './interface';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { VertexAIProvider } from './providers/vertex-ai';
import { GeminiProvider } from './providers/gemini';
import { MetricsAIProvider } from './metrics-wrapper';
import { createLogger } from '../observability/logger';

const logger = createLogger('ai-client');

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

    logger.info('AI Client initialized', {
      defaultProvider: config.defaultProvider,
      availableProviders: Object.keys(this.providers),
      providerCount: Object.keys(this.providers).length,
    });
  }

  private initializeProviders(): void {
    // Initialize OpenAI or Gemini if configured
    if (this.config.openai?.apiKey) {
      try {
        // Check if this is actually Gemini based on the baseURL
        const isGemini = this.config.openai.baseURL?.includes('generativelanguage.googleapis.com');

        if (isGemini) {
          // Use Gemini provider for Google's API
          const provider = new GeminiProvider({
            apiKey: this.config.openai.apiKey,
            ...(this.config.openai.model && { model: this.config.openai.model }),
            ...(this.config.openai.baseURL && { baseURL: this.config.openai.baseURL }),
            ...(this.config.defaults?.temperature !== undefined && {
              temperature: this.config.defaults.temperature,
            }),
            ...(this.config.defaults?.max_tokens !== undefined && {
              maxTokens: this.config.defaults.max_tokens,
            }),
          });

          if (provider.isAvailable()) {
            this.providers.openai = new MetricsAIProvider(provider); // Still register as 'openai' for compatibility
            logger.debug('Gemini provider initialized via OpenAI configuration', {
              provider: 'gemini',
              hasMetrics: true,
            });
          }
        } else {
          // Use standard OpenAI provider
          const provider = new OpenAIProvider({
            apiKey: this.config.openai.apiKey,
            ...(this.config.openai.model && { model: this.config.openai.model }),
            ...(this.config.openai.baseURL && { baseURL: this.config.openai.baseURL }),
            ...(this.config.defaults?.temperature !== undefined && {
              temperature: this.config.defaults.temperature,
            }),
            ...(this.config.defaults?.max_tokens !== undefined && {
              maxTokens: this.config.defaults.max_tokens,
            }),
          });

          if (provider.isAvailable()) {
            this.providers.openai = new MetricsAIProvider(provider);
            logger.debug('OpenAI provider initialized', {
              provider: 'openai',
              hasMetrics: true,
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to initialize OpenAI/Gemini provider', {
          err: error,
          errorCode: 'AI_PROVIDER_INIT_ERROR',
          errorType: 'configuration',
          recoverable: true,
        });
      }
    }

    // Initialize Anthropic if configured
    if (this.config.anthropic?.apiKey) {
      try {
        const provider = new AnthropicProvider({
          apiKey: this.config.anthropic.apiKey,
          ...(this.config.anthropic.model && { model: this.config.anthropic.model }),
          ...(this.config.defaults?.temperature !== undefined && {
            temperature: this.config.defaults.temperature,
          }),
          ...(this.config.defaults?.max_tokens !== undefined && {
            maxTokens: this.config.defaults.max_tokens,
          }),
        });

        if (provider.isAvailable()) {
          this.providers.anthropic = new MetricsAIProvider(provider);
          logger.debug('Anthropic provider initialized', {
            provider: 'anthropic',
            hasMetrics: true,
          });
        }
      } catch (error) {
        logger.warn('Failed to initialize Anthropic provider', {
          err: error,
          errorCode: 'AI_PROVIDER_INIT_ERROR',
          errorType: 'configuration',
          recoverable: true,
        });
      }
    }

    // Initialize Vertex AI if configured
    if (this.config.vertexAI?.projectId) {
      try {
        const provider = new VertexAIProvider({
          projectId: this.config.vertexAI.projectId,
          location: this.config.vertexAI.location,
          ...(this.config.vertexAI.model && { model: this.config.vertexAI.model }),
          ...(this.config.vertexAI.credentials && {
            credentials: this.config.vertexAI.credentials,
          }),
          ...(this.config.defaults?.temperature !== undefined && {
            temperature: this.config.defaults.temperature,
          }),
          ...(this.config.defaults?.max_tokens !== undefined && {
            maxTokens: this.config.defaults.max_tokens,
          }),
        });

        if (provider.isAvailable()) {
          this.providers['vertex-ai'] = new MetricsAIProvider(provider);
          logger.debug('Vertex AI provider initialized', {
            provider: 'vertex-ai',
            hasMetrics: true,
          });
        }
      } catch (error) {
        logger.warn('Failed to initialize Vertex AI provider', {
          err: error,
          errorCode: 'AI_PROVIDER_INIT_ERROR',
          errorType: 'configuration',
          recoverable: true,
        });
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

  async stream(
    messages: AIMessage[],
    options: AICompletionOptions = {},
  ): Promise<AIStreamResponse> {
    const finalOptions = this.mergeOptions(options);
    return this.defaultProvider.stream(messages, finalOptions);
  }

  async ask(prompt: string, options: AICompletionOptions = {}): Promise<string> {
    const finalOptions = this.mergeOptions(options);
    return this.defaultProvider.ask(prompt, finalOptions);
  }

  async completeWith(
    provider: string,
    messages: AIMessage[],
    options: AICompletionOptions = {},
  ): Promise<AIResponse> {
    const providerInstance = this.getProvider(provider);
    const finalOptions = this.mergeOptions(options);
    return providerInstance.complete(messages, finalOptions);
  }

  async streamWith(
    provider: string,
    messages: AIMessage[],
    options: AICompletionOptions = {},
  ): Promise<AIStreamResponse> {
    const providerInstance = this.getProvider(provider);
    const finalOptions = this.mergeOptions(options);
    return providerInstance.stream(messages, finalOptions);
  }

  async askWith(
    provider: string,
    prompt: string,
    options: AICompletionOptions = {},
  ): Promise<string> {
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
      throw new Error(
        `Provider '${provider}' not found. Available providers: ${Object.keys(this.providers).join(
          ', ',
        )}`,
      );
    }
    return providerInstance;
  }

  /**
   * Merge default options with provided options
   */
  private mergeOptions(options: AICompletionOptions): AICompletionOptions {
    return {
      ...(this.config.defaults?.temperature !== undefined && {
        temperature: this.config.defaults.temperature,
      }),
      ...(this.config.defaults?.max_tokens !== undefined && {
        max_tokens: this.config.defaults.max_tokens,
      }),
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
    defaultProvider:
      (process.env.AI_DEFAULT_PROVIDER as 'openai' | 'anthropic' | 'vertex-ai') ?? 'openai',
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
      ...(process.env.GOOGLE_APPLICATION_CREDENTIALS && {
        credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      }),
    };
  }

  // Gemini configuration (via OpenAI compatible endpoint)
  if (process.env.GEMINI_API_KEY || process.env.AI_PROVIDER === 'gemini') {
    config.openai = {
      apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      ...(process.env.GEMINI_MODEL && { model: process.env.GEMINI_MODEL }),
    };
    // Override default provider if explicitly set to gemini
    if (process.env.AI_PROVIDER === 'gemini') {
      config.defaultProvider = 'openai'; // Gemini uses OpenAI config
    }
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

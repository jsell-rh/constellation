/**
 * Gemini provider implementation using OpenAI SDK directly
 */

import OpenAI from 'openai';
import type {
  AIProvider,
  AIMessage as ConstellationMessage,
  AIResponse,
  AIStreamResponse,
  AICompletionOptions,
} from '../interface';

export interface GeminiProviderConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';
  private client: OpenAI;
  private config: GeminiProviderConfig;

  constructor(config: GeminiProviderConfig) {
    this.config = {
      model: 'gemini-2.5-flash',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      temperature: 0.7,
      maxTokens: 2048,
      ...config,
    };

    // Log configuration for debugging
    console.log('Gemini Provider Config:', {
      model: this.config.model,
      baseURL: this.config.baseURL,
      hasApiKey: !!config.apiKey,
    });

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: this.config.baseURL,
    });
  }

  async complete(
    messages: ConstellationMessage[],
    options: AICompletionOptions = {},
  ): Promise<AIResponse> {
    // Convert messages to OpenAI format
    const openAIMessages = this.convertMessages(messages, options.system);

    try {
      const temperature = options.temperature ?? this.config.temperature;
      const maxTokens = options.max_tokens ?? this.config.maxTokens;

      const completion = await this.client.chat.completions.create({
        model: this.config.model!,
        messages: openAIMessages,
        ...(temperature !== undefined && { temperature }),
        ...(maxTokens !== undefined && { max_tokens: maxTokens }),
        top_p: 1,
        presence_penalty: 0,
        // Explicitly exclude frequency_penalty for Gemini
        ...(options.stop && { stop: options.stop }),
      });

      const choice = completion.choices[0];
      if (!choice?.message) {
        throw new Error('No response from Gemini');
      }

      return {
        content: choice.message.content || '',
        ...(completion.usage && {
          usage: {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          },
        }),
        model: completion.model,
        finish_reason: choice.finish_reason || undefined,
      };
    } catch (error: any) {
      console.error('Gemini Provider Error:', {
        message: error.message,
        status: error.status,
        error: error.error,
      });

      throw new Error(
        `Gemini completion failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async stream(
    messages: ConstellationMessage[],
    options: AICompletionOptions = {},
  ): Promise<AIStreamResponse> {
    // Convert messages to OpenAI format
    const openAIMessages = this.convertMessages(messages, options.system);

    const temperature = options.temperature ?? this.config.temperature;
    const maxTokens = options.max_tokens ?? this.config.maxTokens;

    const stream = await this.client.chat.completions.create({
      model: this.config.model!,
      messages: openAIMessages,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { max_tokens: maxTokens }),
      top_p: 1,
      presence_penalty: 0,
      stream: true,
      ...(options.stop && { stop: options.stop }),
    });

    let usage: AIStreamResponse['usage'];
    let model: string | undefined;

    async function* streamGenerator(): AsyncGenerator<string, void, unknown> {
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          yield choice.delta.content;
        }

        // Capture usage from the last chunk
        if (chunk.usage) {
          usage = {
            prompt_tokens: chunk.usage.prompt_tokens,
            completion_tokens: chunk.usage.completion_tokens,
            total_tokens: chunk.usage.total_tokens,
          };
        }
        if (chunk.model) {
          model = chunk.model;
        }
      }
    }

    const result = streamGenerator();

    // Add usage and model properties to the async iterable
    Object.defineProperty(result, 'usage', {
      get: () => usage,
      enumerable: true,
    });

    Object.defineProperty(result, 'model', {
      get: () => model || this.config.model,
      enumerable: true,
    });

    return result as AIStreamResponse;
  }

  async ask(prompt: string, options: AICompletionOptions = {}): Promise<string> {
    const messages: ConstellationMessage[] = [{ role: 'user', content: prompt }];
    const response = await this.complete(messages, options);
    return response.content;
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey);
  }

  getSupportedModels(): string[] {
    return ['gemini-2.5-flash', 'gemini-2.0-flash-latest', 'gemini-1.5-flash', 'gemini-pro'];
  }

  private convertMessages(
    messages: ConstellationMessage[],
    systemPrompt?: string,
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    // Convert constellation messages to OpenAI format
    for (const msg of messages) {
      result.push({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      });
    }

    return result;
  }
}

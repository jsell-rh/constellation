/**
 * Anthropic provider implementation using LangChain
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { 
  AIProvider, 
  AIMessage as ConstellationMessage, 
  AIResponse, 
  AIStreamResponse, 
  AICompletionOptions 
} from '../interface';

export interface AnthropicProviderConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AnthropicProvider implements AIProvider {
  public readonly name = 'anthropic';
  private llm: ChatAnthropic;
  private config: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig) {
    this.config = {
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 4096,
      ...config,
    };

    this.llm = new ChatAnthropic({
      anthropicApiKey: config.apiKey,
      ...(this.config.model && { modelName: this.config.model }),
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.maxTokens !== undefined && { maxTokens: this.config.maxTokens }),
    });
  }

  async complete(messages: ConstellationMessage[], options: AICompletionOptions = {}): Promise<AIResponse> {
    const langchainMessages = this.convertMessages(messages, options.system);
    
    // Create new instance with specific options if needed
    let llm = this.llm;
    if (options.max_tokens || options.temperature !== undefined) {
      llm = new ChatAnthropic({
        anthropicApiKey: this.config.apiKey,
        ...(this.config.model && { modelName: this.config.model }),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : this.config.temperature !== undefined && { temperature: this.config.temperature }),
        ...(options.max_tokens ? { maxTokens: options.max_tokens } : this.config.maxTokens !== undefined && { maxTokens: this.config.maxTokens }),
      });
    }
    
    try {
      const response = await llm.invoke(langchainMessages, {
        ...(options.timeout && { timeout: options.timeout }),
      });

      return {
        content: response.content as string,
        ...(response.usage_metadata && {
          usage: {
            prompt_tokens: response.usage_metadata.input_tokens,
            completion_tokens: response.usage_metadata.output_tokens,
            total_tokens: response.usage_metadata.total_tokens,
          }
        }),
        ...(this.config.model && { model: this.config.model }),
        ...(response.response_metadata?.stop_reason && { finish_reason: response.response_metadata.stop_reason }),
      };
    } catch (error) {
      throw new Error(`Anthropic completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stream(messages: ConstellationMessage[], options: AICompletionOptions = {}): Promise<AIStreamResponse> {
    const langchainMessages = this.convertMessages(messages, options.system);
    
    // Create new instance with specific options if needed
    let llm = this.llm;
    if (options.max_tokens || options.temperature !== undefined) {
      llm = new ChatAnthropic({
        anthropicApiKey: this.config.apiKey,
        ...(this.config.model && { modelName: this.config.model }),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : this.config.temperature !== undefined && { temperature: this.config.temperature }),
        ...(options.max_tokens ? { maxTokens: options.max_tokens } : this.config.maxTokens !== undefined && { maxTokens: this.config.maxTokens }),
      });
    }

    const stream = await llm.stream(langchainMessages, {
      ...(options.timeout && { timeout: options.timeout }),
    });

    let usage: AIStreamResponse['usage'];
    let model: string | undefined;

    async function* streamGenerator(): AsyncGenerator<string, void, unknown> {
      for await (const chunk of stream) {
        if (chunk.content) {
          const content = typeof chunk.content === 'string' 
            ? chunk.content 
            : JSON.stringify(chunk.content);
          yield content;
        }
        
        // Capture usage and model from the last chunk
        if (chunk.usage_metadata) {
          usage = {
            prompt_tokens: chunk.usage_metadata.input_tokens,
            completion_tokens: chunk.usage_metadata.output_tokens,
            total_tokens: chunk.usage_metadata.total_tokens,
          };
        }
        if (chunk.response_metadata?.model) {
          model = chunk.response_metadata.model as string;
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
    const messages: ConstellationMessage[] = [
      { role: 'user', content: prompt }
    ];
    
    const response = await this.complete(messages, options);
    return response.content;
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey);
  }

  getSupportedModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  private convertMessages(messages: ConstellationMessage[], systemPrompt?: string): Array<SystemMessage | HumanMessage | AIMessage> {
    const result: Array<SystemMessage | HumanMessage | AIMessage> = [];

    // Add system prompt if provided
    if (systemPrompt) {
      result.push(new SystemMessage(systemPrompt));
    }

    // Convert constellation messages to LangChain messages
    for (const msg of messages) {
      switch (msg.role) {
        case 'system':
          result.push(new SystemMessage(msg.content));
          break;
        case 'user':
          result.push(new HumanMessage(msg.content));
          break;
        case 'assistant':
          result.push(new AIMessage(msg.content));
          break;
      }
    }

    return result;
  }
}
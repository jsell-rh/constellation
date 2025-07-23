/**
 * OpenAI provider implementation using LangChain
 */

import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { 
  AIProvider, 
  AIMessage as ConstellationMessage, 
  AIResponse, 
  AIStreamResponse, 
  AICompletionOptions 
} from '../interface';

export interface OpenAIProviderConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai';
  private llm: ChatOpenAI;
  private config: OpenAIProviderConfig;

  constructor(config: OpenAIProviderConfig) {
    this.config = {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2048,
      ...config,
    };

    this.llm = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      ...(this.config.model && { modelName: this.config.model }),
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.maxTokens !== undefined && { maxTokens: this.config.maxTokens }),
      ...(config.baseURL && { openAIApiBase: config.baseURL }),
    });
  }

  async complete(messages: ConstellationMessage[], options: AICompletionOptions = {}): Promise<AIResponse> {
    const langchainMessages = this.convertMessages(messages, options.system);
    
    // Apply options to the LLM instance
    const llm = this.llm.bind({
      ...(options.max_tokens && { maxTokens: options.max_tokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.stop && { stop: options.stop }),
    });

    try {
      const response = await llm.invoke(langchainMessages, {
        ...(options.timeout && { timeout: options.timeout }),
      });

      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);
      
      return {
        content,
        ...(response.usage_metadata && {
          usage: {
            prompt_tokens: response.usage_metadata.input_tokens,
            completion_tokens: response.usage_metadata.output_tokens,
            total_tokens: response.usage_metadata.total_tokens,
          }
        }),
        ...(this.config.model && { model: this.config.model }),
        ...(response.response_metadata?.finish_reason && { 
          finish_reason: response.response_metadata.finish_reason as string 
        }),
      };
    } catch (error) {
      throw new Error(`OpenAI completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stream(messages: ConstellationMessage[], options: AICompletionOptions = {}): Promise<AIStreamResponse> {
    const langchainMessages = this.convertMessages(messages, options.system);
    
    // Apply options to the LLM instance
    const llm = this.llm.bind({
      ...(options.max_tokens && { maxTokens: options.max_tokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.stop && { stop: options.stop }),
    });

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
        if (chunk.response_metadata?.model_name) {
          model = chunk.response_metadata.model_name as string;
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
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4o',
      'gpt-4o-mini', 
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
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
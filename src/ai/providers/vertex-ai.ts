/**
 * Google Vertex AI provider implementation using LangChain
 */

import { ChatVertexAI } from '@langchain/google-vertexai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { 
  AIProvider, 
  AIMessage as ConstellationMessage, 
  AIResponse, 
  AIStreamResponse, 
  AICompletionOptions 
} from '../interface';

export interface VertexAIProviderConfig {
  projectId: string;
  location: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  credentials?: string; // Path to service account key file
}

export class VertexAIProvider implements AIProvider {
  public readonly name = 'vertex-ai';
  private llm: ChatVertexAI;
  private config: VertexAIProviderConfig;

  constructor(config: VertexAIProviderConfig) {
    this.config = {
      model: 'gemini-1.5-pro',
      temperature: 0.7,
      maxTokens: 8192,
      ...config,
      // location is required, so we ensure it has a default if not provided
      location: config.location || 'us-central1',
    };

    // Set up authentication if credentials path is provided
    if (config.credentials) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = config.credentials;
    }

    this.llm = new ChatVertexAI({
      model: this.config.model || 'gemini-1.5-pro',
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.maxTokens !== undefined && { maxOutputTokens: this.config.maxTokens }),
      location: this.config.location,
      authOptions: {
        projectId: this.config.projectId,
      },
    });
  }

  async complete(messages: ConstellationMessage[], options: AICompletionOptions = {}): Promise<AIResponse> {
    const langchainMessages = this.convertMessages(messages, options.system);
    
    // Apply options to the LLM instance
    const llm = this.llm.bind({
      ...(options.max_tokens && { maxOutputTokens: options.max_tokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.stop && { stopSequences: options.stop }),
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
      throw new Error(`Vertex AI completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stream(messages: ConstellationMessage[], options: AICompletionOptions = {}): Promise<AIStreamResponse> {
    const langchainMessages = this.convertMessages(messages, options.system);
    
    // Apply options to the LLM instance
    const llm = this.llm.bind({
      ...(options.max_tokens && { maxOutputTokens: options.max_tokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.stop && { stopSequences: options.stop }),
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
    return Boolean(this.config.projectId && this.config.location);
  }

  getSupportedModels(): string[] {
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      'gemini-pro-vision',
      'chat-bison',
      'chat-bison-32k',
      'codechat-bison',
      'codechat-bison-32k',
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
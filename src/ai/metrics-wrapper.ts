/**
 * AI Provider wrapper that adds metrics collection
 */

import type {
  AIProvider,
  AIMessage,
  AIResponse,
  AICompletionOptions,
  AIStreamResponse,
} from './interface';
import {
  aiRequests,
  aiTokensUsed,
  aiRequestDuration,
  recordError,
  timeExecution,
} from '../observability/metrics';
import { createLogger } from '../observability/logger';

const logger = createLogger('ai-metrics');

/**
 * Wraps an AI provider to add metrics collection
 */
export class MetricsAIProvider implements AIProvider {
  constructor(private readonly provider: AIProvider) {}

  get name(): string {
    return this.provider.name;
  }

  async complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AIResponse> {
    const labels = {
      provider: this.provider.name,
      model: 'default', // Will be updated from response
      operation: 'complete',
    };

    try {
      const response = await timeExecution(aiRequestDuration, labels, () =>
        this.provider.complete(messages, options),
      );

      // Update model label if available
      if (response.model) {
        labels.model = response.model;
      }

      // Record successful request
      aiRequests.inc({ ...labels, status: 'success' });

      // Record token usage if available
      if (response.usage) {
        aiTokensUsed.inc(
          {
            provider: this.provider.name,
            model: response.model || 'default',
            type: 'prompt',
          },
          response.usage.prompt_tokens,
        );

        aiTokensUsed.inc(
          {
            provider: this.provider.name,
            model: response.model || 'default',
            type: 'completion',
          },
          response.usage.completion_tokens,
        );

        logger.debug('AI request completed with token usage', {
          provider: this.provider.name,
          model: response.model,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.prompt_tokens + response.usage.completion_tokens,
        });
      }

      return response;
    } catch (error) {
      // Record failed request
      aiRequests.inc({ ...labels, status: 'error' });

      recordError(error, {
        type: 'ai_request',
        librarian: 'ai_provider',
      });

      throw error;
    }
  }

  async stream(messages: AIMessage[], options?: AICompletionOptions): Promise<AIStreamResponse> {
    const labels = {
      provider: this.provider.name,
      model: 'default',
      operation: 'stream',
    };

    const timer = aiRequestDuration.startTimer(labels);

    try {
      const stream = await this.provider.stream(messages, options);
      aiRequests.inc({ ...labels, status: 'success' });

      // Wrap the async iterator to record metrics when done
      const wrappedStream: AIStreamResponse = {
        [Symbol.asyncIterator]: async function* () {
          try {
            for await (const chunk of stream) {
              yield chunk;
            }
          } finally {
            timer();

            // Record token usage if available
            if (stream.usage) {
              aiTokensUsed.inc(
                {
                  provider: labels.provider,
                  model: stream.model || 'default',
                  type: 'prompt',
                },
                stream.usage.prompt_tokens,
              );

              aiTokensUsed.inc(
                {
                  provider: labels.provider,
                  model: stream.model || 'default',
                  type: 'completion',
                },
                stream.usage.completion_tokens,
              );
            }
          }
        },
        ...(stream.usage && { usage: stream.usage }),
        ...(stream.model && { model: stream.model }),
      };

      return wrappedStream;
    } catch (error) {
      timer();
      aiRequests.inc({ ...labels, status: 'error' });

      recordError(error, {
        type: 'ai_stream',
        librarian: 'ai_provider',
      });

      throw error;
    }
  }

  async ask(prompt: string, options?: AICompletionOptions): Promise<string> {
    const labels = {
      provider: this.provider.name,
      model: 'default',
      operation: 'ask',
    };

    try {
      const result = await timeExecution(aiRequestDuration, labels, () =>
        this.provider.ask(prompt, options),
      );

      aiRequests.inc({ ...labels, status: 'success' });
      return result;
    } catch (error) {
      aiRequests.inc({ ...labels, status: 'error' });

      recordError(error, {
        type: 'ai_ask',
        librarian: 'ai_provider',
      });

      throw error;
    }
  }

  isAvailable(): boolean {
    return this.provider.isAvailable();
  }

  getSupportedModels(): string[] {
    return this.provider.getSupportedModels();
  }
}

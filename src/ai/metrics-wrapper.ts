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
      logger.debug('Checking AI response for usage data', {
        provider: this.provider.name,
        hasUsage: !!response.usage,
        usageData: response.usage,
        responseKeys: Object.keys(response),
        model: response.model,
      });

      if (response.usage) {
        const promptLabels = {
          provider: this.provider.name,
          model: response.model || 'default',
          type: 'prompt',
        };
        const completionLabels = {
          provider: this.provider.name,
          model: response.model || 'default',
          type: 'completion',
        };

        logger.debug('Recording token metrics', {
          promptLabels,
          promptTokens: response.usage.prompt_tokens,
          completionLabels,
          completionTokens: response.usage.completion_tokens,
        });

        aiTokensUsed.inc(promptLabels, response.usage.prompt_tokens);
        aiTokensUsed.inc(completionLabels, response.usage.completion_tokens);

        logger.info('AI token usage recorded', {
          provider: this.provider.name,
          model: response.model,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.prompt_tokens + response.usage.completion_tokens,
        });
      } else {
        logger.warn('No usage data in AI response', {
          provider: this.provider.name,
          model: response.model,
          responseKeys: Object.keys(response),
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
      // Instead of calling provider.ask() which loses usage data,
      // call complete() and extract the content
      const messages: AIMessage[] = [{ role: 'user', content: prompt }];
      const timer = aiRequestDuration.startTimer(labels);

      const response = await this.provider.complete(messages, options);
      timer();

      // Record successful request
      aiRequests.inc({ ...labels, status: 'success' });

      // Record token usage if available (from complete response)
      if (response.usage) {
        logger.debug('Recording token metrics from ask operation', {
          provider: this.provider.name,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
        });

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
      }

      return response.content;
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

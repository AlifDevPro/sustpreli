import Groq from 'groq-sdk';
import type { Logger } from 'pino';

import type { Env } from '../config';
import { withTimeout } from '../utils/abort-utils';
import { getHttpsAgent } from '../utils/http-agents';

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqChatParams {
  messages: GroqChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs: number;
  responseFormat?: 'json_object';
  requestId?: string;
}

export interface GroqChatResult {
  content: string;
  model: string;
  finishReason: string | null;
  durationMs: number;
  attempt: number;
}

export interface IGroqClient {
  isConfigured(): boolean;
  chatCompletion(params: GroqChatParams): Promise<GroqChatResult>;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('429') ||
    message.includes('503') ||
    message.includes('rate limit') ||
    message.includes('econnreset')
  );
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('timeout');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class GroqClient implements IGroqClient {
  private readonly client: Groq | null;

  constructor(
    private readonly config: Env,
    private readonly logger?: Logger,
  ) {
    this.client = config.GROQ_API_KEY
      ? new Groq({
          apiKey: config.GROQ_API_KEY,
          baseURL: config.GROQ_BASE_URL,
          httpAgent: getHttpsAgent(),
          fetch: globalThis.fetch.bind(globalThis),
          maxRetries: 0,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async chatCompletion(params: GroqChatParams): Promise<GroqChatResult> {
    if (!this.client) {
      throw new Error('Groq client is not configured');
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.GROQ_MAX_RETRIES; attempt += 1) {
      const startedAt = Date.now();

      try {
        const result = await withTimeout(
          this.executeChat(params),
          params.timeoutMs,
          `Groq chat timed out after ${params.timeoutMs}ms`,
        );

        const durationMs = Date.now() - startedAt;
        this.logger?.info(
          {
            requestId: params.requestId,
            model: result.model,
            attempt: attempt + 1,
            durationMs,
            finishReason: result.finishReason,
          },
          'groq chat completed',
        );

        return {
          ...result,
          durationMs,
          attempt: attempt + 1,
        };
      } catch (error) {
        lastError = error;
        const durationMs = Date.now() - startedAt;

        this.logger?.warn(
          {
            requestId: params.requestId,
            attempt: attempt + 1,
            durationMs,
            err: error instanceof Error ? error.message : String(error),
            retryable: isRetryableError(error),
          },
          'groq chat attempt failed',
        );

        if (
          attempt < this.config.GROQ_MAX_RETRIES &&
          isRetryableError(error) &&
          !isTimeoutError(error)
        ) {
          await sleep(this.config.GROQ_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }

        throw error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Groq chat failed');
  }

  private async executeChat(
    params: GroqChatParams,
  ): Promise<Omit<GroqChatResult, 'durationMs' | 'attempt'>> {
    const response = await this.client!.chat.completions.create({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.2,
      max_tokens: params.maxTokens ?? this.config.GROQ_PROSE_MAX_TOKENS,
      response_format: params.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
    });

    const choice = response.choices[0];
    const content = choice?.message?.content;

    if (!content || content.trim().length === 0) {
      throw new Error('Groq returned empty content');
    }

    return {
      content: content.trim(),
      model: response.model,
      finishReason: choice.finish_reason ?? null,
    };
  }
}

import type { Logger } from 'pino';

import type { Env } from '../config';
import { calculateGroqTimeoutMs } from '../config/performance';
import type { TicketRequest } from '../domain/models/ticket-request.model';
import type { InvestigationDecision } from '../domain/models/investigation-result.model';
import { buildSafeProse, type DecisionBrief } from '../security/safe-templates';
import type { ProseFields, SecuredInput } from '../security/types';
import { toDecisionBrief } from '../security/response-text.generator';
import type { PerformanceContext } from '../utils/performance-profiler';
import { remainingMs } from '../utils/performance-profiler';
import type { IGroqClient } from './groq.client';
import { GroqClient } from './groq.client';
import { ProseParseError, parseGroqProseJson, toProseFields } from './parsers/prose.parser';
import { buildProseMessages } from './prompts/prose.prompt';

export type ProseSource = 'groq' | 'fallback';

export interface ProseGenerationOptions {
  performance?: PerformanceContext;
  requestId?: string;
  signal?: AbortSignal;
}

export interface ProseGenerationResult {
  prose: ProseFields;
  source: ProseSource;
  model?: string;
  attempts: number;
  skippedReason?: 'not_configured' | 'deadline_exhausted';
}

export class AiProseService {
  constructor(
    private readonly groqClient: IGroqClient,
    private readonly config: Env,
    private readonly logger?: Logger,
  ) {}

  async generateProse(
    request: TicketRequest,
    decision: InvestigationDecision,
    secured: SecuredInput,
    options: ProseGenerationOptions = {},
  ): Promise<ProseGenerationResult> {
    const brief = toDecisionBrief(request, decision);
    const requestId = options.requestId ?? options.performance?.requestId;

    if (options.signal?.aborted) {
      this.logger?.warn({ requestId }, 'request aborted before groq; using fallback');
      return this.fallbackResult(brief, 0, 'deadline_exhausted');
    }

    if (!this.groqClient.isConfigured()) {
      this.logger?.debug({ requestId, ticketId: brief.ticketId }, 'groq not configured; using fallback');
      return this.fallbackResult(brief, 0, 'not_configured');
    }

    const groqTimeoutMs = this.resolveGroqTimeoutMs(options.performance);
    if (groqTimeoutMs === 0) {
      this.logger?.warn(
        { requestId, ticketId: brief.ticketId, remainingMs: options.performance ? remainingMs(options.performance) : 0 },
        'request deadline too tight; skipping groq and using fallback',
      );
      return this.fallbackResult(brief, 0, 'deadline_exhausted');
    }

    const maxAttempts = this.config.GROQ_MAX_RETRIES + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (options.signal?.aborted) {
        break;
      }

      const attemptTimeoutMs = this.resolveGroqTimeoutMs(options.performance);
      if (attemptTimeoutMs === 0) {
        break;
      }

      try {
        const prose = await this.callGroq(brief, secured, attempt, attemptTimeoutMs, requestId);
        return {
          prose,
          source: 'groq',
          model: this.config.GROQ_MODEL,
          attempts: attempt,
        };
      } catch (error) {
        lastError = error;

        if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
          this.logger?.warn(
            { requestId, ticketId: brief.ticketId, attempt },
            'groq prose timed out; using fallback without further retries',
          );
          break;
        }

        const retryable =
          error instanceof ProseParseError ||
          (error instanceof Error &&
            (error.message.includes('429') ||
              error.message.includes('503') ||
              error.message.includes('empty content')));

        this.logger?.warn(
          {
            requestId,
            attempt,
            maxAttempts,
            err: error instanceof Error ? error.message : String(error),
            ticketId: brief.ticketId,
          },
          'groq prose generation attempt failed',
        );

        if (!retryable || attempt >= maxAttempts) {
          break;
        }

        await this.delay(this.config.GROQ_RETRY_DELAY_MS * attempt);
      }
    }

    this.logger?.error(
      {
        requestId,
        err: lastError instanceof Error ? lastError.message : String(lastError),
        ticketId: brief.ticketId,
      },
      'groq prose generation exhausted; using fallback',
    );

    return this.fallbackResult(brief, maxAttempts);
  }

  private resolveGroqTimeoutMs(performance?: PerformanceContext): number {
    if (!performance) {
      return this.config.GROQ_PROSE_TIMEOUT_MS;
    }

    return calculateGroqTimeoutMs(remainingMs(performance), this.config.GROQ_PROSE_TIMEOUT_MS);
  }

  private async callGroq(
    brief: DecisionBrief,
    secured: SecuredInput,
    attempt: number,
    timeoutMs: number,
    requestId?: string,
  ): Promise<ProseFields> {
    const messages = buildProseMessages({
      brief,
      isolatedComplaint: secured.complaint.wrappedForLlm,
      injectionWarning: secured.complaint.containsHighRiskInjection,
    });

    this.logger?.debug(
      { requestId, ticketId: brief.ticketId, attempt, model: this.config.GROQ_MODEL, timeoutMs },
      'groq prose request',
    );

    const result = await this.groqClient.chatCompletion({
      messages,
      model: this.config.GROQ_MODEL,
      temperature: 0.2,
      maxTokens: this.config.GROQ_PROSE_MAX_TOKENS,
      timeoutMs,
      responseFormat: 'json_object',
      requestId,
    });

    const parsed = parseGroqProseJson(result.content);
    return toProseFields(parsed);
  }

  private fallbackResult(
    brief: DecisionBrief,
    attempts: number,
    skippedReason?: ProseGenerationResult['skippedReason'],
  ): ProseGenerationResult {
    return {
      prose: buildSafeProse(brief),
      source: 'fallback',
      attempts,
      skippedReason,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

export function createAiProseService(
  config: Env,
  groqClient?: IGroqClient,
  logger?: Logger,
): AiProseService {
  return new AiProseService(groqClient ?? new GroqClient(config, logger), config, logger);
}

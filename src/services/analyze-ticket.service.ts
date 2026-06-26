import type { Logger } from 'pino';

import { PERFORMANCE_BUDGETS } from '../config/performance';
import type { AnalyzeTicketPipeline } from '../pipelines/analyze-ticket.pipeline';
import type { RawTicketResponse } from '../domain/models/ticket-response.model';
import type { PerformanceContext } from '../utils/performance-profiler';
import { mark, summarize } from '../utils/performance-profiler';
import { type RequestValidator } from '../validation/request.validator';

export class AnalyzeTicketService {
  constructor(
    private readonly validator: RequestValidator,
    private readonly pipeline: AnalyzeTicketPipeline,
  ) {}

  async analyze(
    rawBody: unknown,
    requestId: string,
    logger?: Logger,
    performance?: PerformanceContext,
    signal?: AbortSignal,
  ): Promise<RawTicketResponse> {
    const validationStart = Date.now();
    const ticket = this.validator.validateAndMap(rawBody);
    if (performance) {
      mark(performance, 'validation', validationStart);
    }

    const result = await this.pipeline.execute(ticket, {
      performance,
      requestId,
      signal,
    });

    if (logger && performance) {
      const summary = summarize(performance);
      const logPayload = {
        requestId,
        ticketId: ticket.ticketId,
        proseSource: result.proseSource,
        proseAttempts: result.proseAttempts,
        safetyPassed: result.safetyPassed,
        ...summary,
      };

      if (Number(summary.totalMs) >= PERFORMANCE_BUDGETS.SLOW_REQUEST_THRESHOLD_MS) {
        logger.warn(logPayload, 'analyze-ticket slow path completed');
      } else {
        logger.info(logPayload, 'analyze-ticket completed');
      }
    }

    return result.raw;
  }
}

export function createAnalyzeTicketService(
  validator: RequestValidator,
  pipeline: AnalyzeTicketPipeline,
): AnalyzeTicketService {
  return new AnalyzeTicketService(validator, pipeline);
}

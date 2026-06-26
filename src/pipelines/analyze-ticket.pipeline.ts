import type { TicketRequest } from '../domain/models/ticket-request.model';
import type { InvestigationDecision } from '../domain/models/investigation-result.model';
import type { TicketResponse } from '../domain/models/ticket-response.model';
import type { ProseSource } from '../ai/ai-prose.service';
import { AiPipeline } from '../ai/ai.pipeline';
import { toRawTicketResponse } from '../assembly/response.assembler';
import type { PerformanceContext } from '../utils/performance-profiler';
import { mark } from '../utils/performance-profiler';
import { investigationPipeline } from './investigation.pipeline';
import { responsePipeline } from './response.pipeline';
import { securityPipeline } from './security.pipeline';

export interface AnalyzeTicketResult {
  response: TicketResponse;
  raw: ReturnType<typeof toRawTicketResponse>;
  decision: InvestigationDecision;
  injectionDetected: boolean;
  safetyPassed: boolean;
  proseSource: ProseSource;
  proseAttempts: number;
}

export interface AnalyzeTicketPipelineOptions {
  performance?: PerformanceContext;
  requestId?: string;
  signal?: AbortSignal;
}

export class AnalyzeTicketPipeline {
  constructor(private readonly aiPipeline?: AiPipeline) {}

  async execute(
    request: TicketRequest,
    options: AnalyzeTicketPipelineOptions = {},
  ): Promise<AnalyzeTicketResult> {
    const { performance, requestId, signal } = options;

    const securityStart = Date.now();
    const secured = securityPipeline.secureInput(request);
    if (performance) {
      mark(performance, 'security', securityStart);
    }

    const investigationStart = Date.now();
    const decision = investigationPipeline.run(request);
    if (performance) {
      mark(performance, 'investigation', investigationStart);
    }

    let proseSource: ProseSource = 'fallback';
    let proseAttempts = 0;
    let llmProse: import('../security/types').ProseFields | undefined;

    if (this.aiPipeline && !signal?.aborted) {
      const groqStart = Date.now();
      const proseResult = await this.aiPipeline.generateProse(request, decision, secured, {
        performance,
        requestId,
        signal,
      });
      if (performance) {
        mark(performance, 'groq', groqStart);
      }

      proseSource = proseResult.source;
      proseAttempts = proseResult.attempts;
      if (proseResult.source === 'groq') {
        llmProse = proseResult.prose;
      }
    }

    const responseStart = Date.now();
    const { response, safetyPassed, usedFallback } = responsePipeline.run(
      request,
      decision,
      llmProse,
    );
    if (performance) {
      mark(performance, 'response', responseStart);
    }

    if (usedFallback) {
      proseSource = 'fallback';
    }

    return {
      response,
      raw: toRawTicketResponse(response),
      decision,
      injectionDetected: secured.complaint.injectionFlags.length > 0,
      safetyPassed,
      proseSource,
      proseAttempts,
    };
  }
}

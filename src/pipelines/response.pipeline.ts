import { assembleTicketResponse } from '../assembly/response.assembler';
import type { TicketRequest } from '../domain/models/ticket-request.model';
import type { InvestigationDecision } from '../domain/models/investigation-result.model';
import type { TicketResponse } from '../domain/models/ticket-response.model';
import { generateDeterministicProse, toDecisionBrief } from '../security/response-text.generator';
import { sanitizeGeneratedProse } from '../security/response-sanitizer';
import { scanTicketResponse } from '../security/output-safety.scanner';
import { buildSafeProse } from '../security/safe-templates';
import type { ProseFields } from '../security/types';
import { responseValidator } from '../validation/response.validator';

export interface ResponsePipelineResult {
  response: TicketResponse;
  safetyPassed: boolean;
  usedFallback: boolean;
}

/**
 * Optionally accept LLM-generated prose; always sanitize and validate before returning.
 */
export class ResponsePipeline {
  run(
    request: TicketRequest,
    decision: InvestigationDecision,
    llmProse?: ProseFields,
  ): ResponsePipelineResult {
    const brief = toDecisionBrief(request, decision);
    const draft = llmProse ?? generateDeterministicProse(request, decision);
    const sanitized = sanitizeGeneratedProse(draft, brief, { fromLlm: Boolean(llmProse) });

    let response = assembleTicketResponse(request, decision, sanitized.prose);

    let scan = scanTicketResponse({
      ticketId: response.ticketId,
      agentSummary: response.agentSummary,
      recommendedNextAction: response.recommendedNextAction,
      customerReply: response.customerReply,
      reasonCodes: response.reasonCodes,
    });

    if (!scan.passed) {
      const fallbackProse = buildSafeProse(brief);
      response = assembleTicketResponse(request, decision, fallbackProse);
      scan = scanTicketResponse({
        ticketId: response.ticketId,
        agentSummary: response.agentSummary,
        recommendedNextAction: response.recommendedNextAction,
        customerReply: response.customerReply,
        reasonCodes: response.reasonCodes,
      });
    }

    const validated = responseValidator.validateTicketResponse(response, request);

    return {
      response: validated,
      safetyPassed: scan.passed,
      usedFallback: sanitized.usedFallback || !scan.passed,
    };
  }
}

export const responsePipeline = new ResponsePipeline();

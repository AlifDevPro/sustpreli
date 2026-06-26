import type { TicketRequest } from '../domain/models/ticket-request.model';
import { sanitizeComplaintForAi } from '../security/prompt-sanitizer';
import type { SecuredInput } from '../security/types';

export class SecurityPipeline {
  /**
   * Harden untrusted complaint text before any LLM usage.
   * Business logic uses original complaint via deterministic engines only.
   */
  secureInput(request: TicketRequest): SecuredInput {
    return {
      complaint: sanitizeComplaintForAi(request.complaint),
    };
  }
}

export const securityPipeline = new SecurityPipeline();

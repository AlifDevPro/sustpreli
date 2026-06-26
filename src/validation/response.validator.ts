import type { TicketRequest } from '../domain/models/ticket-request.model';
import type { TicketResponse } from '../domain/models/ticket-response.model';
import { ResponseValidationError } from '../errors/app-error';
import { ticketResponseSchema } from './schemas/response.schema';

function toRawResponse(response: TicketResponse): Record<string, unknown> {
  return {
    ticket_id: response.ticketId,
    relevant_transaction_id: response.relevantTransactionId,
    evidence_verdict: response.evidenceVerdict,
    case_type: response.caseType,
    severity: response.severity,
    department: response.department,
    agent_summary: response.agentSummary,
    recommended_next_action: response.recommendedNextAction,
    customer_reply: response.customerReply,
    human_review_required: response.humanReviewRequired,
    confidence: response.confidence,
    reason_codes: response.reasonCodes,
  };
}

export class ResponseValidator {
  validateTicketResponse(response: TicketResponse, request?: TicketRequest): TicketResponse {
    const raw = toRawResponse(response);
    const parsed = ticketResponseSchema.safeParse(raw);

    if (!parsed.success) {
      throw new ResponseValidationError('Internal response validation failed', parsed.error);
    }

    if (request && response.ticketId !== request.ticketId) {
      throw new ResponseValidationError('ticket_id echo mismatch');
    }

    if (request && response.relevantTransactionId !== null) {
      const exists = request.transactionHistory.some(
        (transaction) => transaction.transactionId === response.relevantTransactionId,
      );
      if (!exists) {
        throw new ResponseValidationError('relevant_transaction_id not in request history');
      }
    }

    return response;
  }
}

export const responseValidator = new ResponseValidator();

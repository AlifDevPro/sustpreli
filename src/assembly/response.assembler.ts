import type { TicketRequest } from '../domain/models/ticket-request.model';
import type { InvestigationDecision } from '../domain/models/investigation-result.model';
import type { TicketResponse, RawTicketResponse } from '../domain/models/ticket-response.model';
import type { ProseFields } from '../security/types';

export function assembleTicketResponse(
  request: TicketRequest,
  decision: InvestigationDecision,
  prose: ProseFields,
): TicketResponse {
  return {
    ticketId: request.ticketId,
    relevantTransactionId: decision.investigation.relevantTransactionId,
    evidenceVerdict: decision.investigation.evidenceVerdict,
    caseType: decision.classification.caseType,
    severity: decision.classification.severity,
    department: decision.classification.department,
    agentSummary: prose.agentSummary,
    recommendedNextAction: prose.recommendedNextAction,
    customerReply: prose.customerReply,
    humanReviewRequired: decision.classification.humanReviewRequired,
    confidence: decision.classification.confidence,
    reasonCodes: decision.classification.reasonCodes,
  };
}

export function toRawTicketResponse(response: TicketResponse): RawTicketResponse {
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

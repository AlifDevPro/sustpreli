import type {
  CaseType,
  Department,
  EvidenceVerdict,
  Severity,
} from '../enums/investigation.enums';

export interface TicketResponse {
  ticketId: string;
  relevantTransactionId: string | null;
  evidenceVerdict: EvidenceVerdict;
  caseType: CaseType;
  severity: Severity;
  department: Department;
  agentSummary: string;
  recommendedNextAction: string;
  customerReply: string;
  humanReviewRequired: boolean;
  confidence: number;
  reasonCodes: string[];
}

export interface RawTicketResponse {
  ticket_id: string;
  relevant_transaction_id: string | null;
  evidence_verdict: EvidenceVerdict;
  case_type: CaseType;
  severity: Severity;
  department: Department;
  agent_summary: string;
  recommended_next_action: string;
  customer_reply: string;
  human_review_required: boolean;
  confidence?: number;
  reason_codes?: string[];
}

import type { CaseType, Severity } from '../../domain/enums/investigation.enums';
import type { InvestigationResult } from '../../domain/models/investigation-result.model';
import type { TicketRequest } from '../../domain/models/ticket-request.model';
import { INVESTIGATION_CONSTANTS } from '../../config/constants';
import type { ComplaintSignals } from '../../utils/keyword-heuristics';

export function resolveSeverity(
  caseType: CaseType,
  investigation: InvestigationResult,
  signals: ComplaintSignals,
  request: TicketRequest,
): Severity {
  if (caseType === 'phishing_or_social_engineering') {
    return 'critical';
  }

  let severity: Severity;

  switch (caseType) {
    case 'wrong_transfer':
      severity =
        investigation.evidenceVerdict === 'inconsistent'
          ? 'medium'
          : investigation.evidenceVerdict === 'insufficient_data'
            ? 'medium'
            : 'high';
      break;
    case 'payment_failed':
    case 'duplicate_payment':
    case 'agent_cash_in_issue':
      severity = 'high';
      break;
    case 'merchant_settlement_delay':
      severity = 'medium';
      break;
    case 'refund_request':
      severity = 'low';
      break;
    default:
      severity = signals.isVague ? 'low' : 'medium';
  }

  const amount =
    investigation.topMatch?.transaction.amount ??
    investigation.duplicatePair?.duplicate.amount ??
    signals.mentionedAmounts[0];

  if (
    amount !== undefined &&
    amount >= INVESTIGATION_CONSTANTS.HIGH_VALUE_THRESHOLD_BDT &&
    (severity === 'low' || severity === 'medium')
  ) {
    severity = 'high';
  }

  if (request.userType === 'merchant' && caseType === 'merchant_settlement_delay') {
    severity = 'medium';
  }

  return severity;
}

import type { CaseType } from '../../domain/enums/investigation.enums';
import type { InvestigationResult } from '../../domain/models/investigation-result.model';
import type { ComplaintSignals } from '../../utils/keyword-heuristics';

export function resolveHumanReviewRequired(
  caseType: CaseType,
  investigation: InvestigationResult,
  signals: ComplaintSignals,
): boolean {
  if (caseType === 'phishing_or_social_engineering') {
    return true;
  }

  if (caseType === 'duplicate_payment' && investigation.duplicatePair) {
    return true;
  }

  if (caseType === 'agent_cash_in_issue') {
    return (
      investigation.topMatch?.transaction.status === 'pending' ||
      signals.mentionsNotReceived ||
      investigation.evidenceVerdict === 'consistent'
    );
  }

  if (caseType === 'wrong_transfer') {
    if (investigation.isAmbiguousMatch || investigation.ambiguityReason === 'ambiguous_match') {
      return false;
    }

    if (investigation.evidenceVerdict === 'insufficient_data' && signals.isVague) {
      return false;
    }

    if (
      investigation.evidenceVerdict === 'consistent' ||
      investigation.evidenceVerdict === 'inconsistent'
    ) {
      return true;
    }

    return false;
  }

  if (investigation.evidenceVerdict === 'inconsistent') {
    return true;
  }

  if (caseType === 'payment_failed' && investigation.evidenceVerdict === 'consistent') {
    return false;
  }

  if (caseType === 'refund_request') {
    return false;
  }

  if (caseType === 'merchant_settlement_delay') {
    return false;
  }

  if (caseType === 'other' && signals.isVague) {
    return false;
  }

  return false;
}

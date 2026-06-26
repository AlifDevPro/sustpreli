import { CONFIDENCE_CONSTANTS } from '../../config/constants';
import type { CaseType } from '../../domain/enums/investigation.enums';
import type { InvestigationResult } from '../../domain/models/investigation-result.model';
import type { ComplaintSignals } from '../../utils/keyword-heuristics';

function clamp(value: number): number {
  return Math.min(CONFIDENCE_CONSTANTS.MAX, Math.max(CONFIDENCE_CONSTANTS.MIN, value));
}

export function calculateConfidence(
  investigation: InvestigationResult,
  caseType: CaseType,
  signals: ComplaintSignals,
): number {
  let confidence = CONFIDENCE_CONSTANTS.BASE;

  const top = investigation.topMatch;

  if (top?.signals.transactionIdMatch) {
    confidence += CONFIDENCE_CONSTANTS.TXN_ID_MATCH;
  }

  if (top?.signals.amountMatch) {
    confidence += CONFIDENCE_CONSTANTS.AMOUNT_MATCH;
  }

  if (top?.signals.typeMatch || top?.signals.statusMatch) {
    confidence += CONFIDENCE_CONSTANTS.TYPE_STATUS_MATCH;
  }

  if (top?.signals.timeMatch) {
    confidence += CONFIDENCE_CONSTANTS.TIME_MATCH;
  }

  if (top?.signals.counterpartyMatch) {
    confidence += CONFIDENCE_CONSTANTS.COUNTERPARTY_MATCH;
  }

  if (investigation.duplicatePair) {
    confidence += CONFIDENCE_CONSTANTS.DUPLICATE_DETECTED;
  }

  if (caseType === 'phishing_or_social_engineering') {
    confidence += CONFIDENCE_CONSTANTS.PHISHING_CLEAR;
  }

  if (investigation.isAmbiguousMatch) {
    confidence -= CONFIDENCE_CONSTANTS.AMBIGUITY_PENALTY;
  }

  if (signals.isVague) {
    confidence -= CONFIDENCE_CONSTANTS.VAGUE_PENALTY;
  }

  if (investigation.evidenceVerdict === 'inconsistent') {
    confidence -= CONFIDENCE_CONSTANTS.INCONSISTENT_PENALTY;
  }

  if (investigation.matches.length === 0 && !signals.isPhishingReport) {
    confidence -= CONFIDENCE_CONSTANTS.NO_HISTORY_PENALTY;
  }

  if (
    investigation.evidenceVerdict === 'consistent' &&
    top &&
    top.signals.amountMatch &&
    (top.signals.typeMatch || top.signals.transactionIdMatch)
  ) {
    confidence += CONFIDENCE_CONSTANTS.CONSISTENT_EVIDENCE_BONUS;
  }

  return Number(clamp(confidence).toFixed(2));
}

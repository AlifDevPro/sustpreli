import type { CaseType } from '../../domain/enums/investigation.enums';
import type { InvestigationResult } from '../../domain/models/investigation-result.model';
import type { ComplaintSignals } from '../../utils/keyword-heuristics';

export function generateReasonCodes(
  caseType: CaseType,
  investigation: InvestigationResult,
  signals: ComplaintSignals,
): string[] {
  const codes = new Set<string>();

  codes.add(caseType === 'phishing_or_social_engineering' ? 'phishing' : caseType);

  if (investigation.relevantTransactionId) {
    codes.add('transaction_match');
  }

  if (investigation.duplicatePair) {
    codes.add('duplicate_payment');
    codes.add('biller_verification_required');
  }

  if (investigation.establishedRecipientPattern) {
    codes.add('established_recipient_pattern');
    codes.add('wrong_transfer_claim');
  }

  if (investigation.evidenceVerdict === 'inconsistent') {
    codes.add('evidence_inconsistent');
  }

  if (investigation.isAmbiguousMatch || investigation.ambiguityReason === 'ambiguous_match') {
    codes.add('ambiguous_match');
    codes.add('needs_clarification');
  }

  if (signals.isVague) {
    codes.add('vague_complaint');
    codes.add('needs_clarification');
  }

  if (caseType === 'phishing_or_social_engineering') {
    codes.add('credential_protection');
    codes.add('critical_escalation');
  }

  if (caseType === 'payment_failed') {
    codes.add('payment_failed');
    if (signals.mentionsBalanceDeducted) {
      codes.add('potential_balance_deduction');
    }
  }

  if (caseType === 'refund_request') {
    codes.add('refund_request');
    codes.add('merchant_policy_dependent');
  }

  if (caseType === 'agent_cash_in_issue') {
    codes.add('agent_cash_in');
    if (investigation.topMatch?.transaction.status === 'pending') {
      codes.add('pending_transaction');
    }
    codes.add('agent_ops');
  }

  if (caseType === 'merchant_settlement_delay') {
    codes.add('merchant_settlement');
    codes.add('delay');
    codes.add('pending');
  }

  return [...codes];
}

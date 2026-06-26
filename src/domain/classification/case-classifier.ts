import type { CaseType } from '../../domain/enums/investigation.enums';
import type { InvestigationResult } from '../../domain/models/investigation-result.model';
import type { TicketRequest } from '../../domain/models/ticket-request.model';
import type { ComplaintSignals } from '../../utils/keyword-heuristics';

export function classifyCaseType(
  request: TicketRequest,
  signals: ComplaintSignals,
  investigation: InvestigationResult,
): CaseType {
  if (signals.isPhishingReport) {
    return 'phishing_or_social_engineering';
  }

  if (investigation.duplicatePair !== null) {
    return 'duplicate_payment';
  }

  if (
    signals.isSettlementDelay &&
    (request.userType === 'merchant' ||
      request.channel === 'merchant_portal' ||
      investigation.topMatch?.transaction.type === 'settlement')
  ) {
    return 'merchant_settlement_delay';
  }

  if (
    signals.isCashInIssue ||
    (investigation.topMatch?.transaction.type === 'cash_in' &&
      (investigation.topMatch.transaction.status === 'pending' || signals.mentionsNotReceived))
  ) {
    return 'agent_cash_in_issue';
  }

  if (
    signals.isPaymentFailed ||
    (signals.mentionsBalanceDeducted && investigation.topMatch?.transaction.status === 'failed')
  ) {
    return 'payment_failed';
  }

  if (
    signals.isWrongTransfer ||
    signals.mentionsReverse ||
    (signals.mentionsNotReceived && investigation.topMatch?.transaction.type === 'transfer')
  ) {
    return 'wrong_transfer';
  }

  if (signals.isRefundRequest && !signals.isPaymentFailed) {
    return 'refund_request';
  }

  if (signals.isVague) {
    return 'other';
  }

  if (investigation.isAmbiguousMatch && (signals.mentionsNotReceived || signals.isWrongTransfer)) {
    return 'wrong_transfer';
  }

  return 'other';
}

import type { CaseType, EvidenceVerdict, Severity } from '../domain/enums/investigation.enums';
import type { Department } from '../domain/enums/investigation.enums';
import type { Language, TransactionStatus, TransactionType, UserType } from '../domain/enums';
import type { ProseFields } from './types';

export interface DuplicatePairBrief {
  originalTransactionId: string;
  duplicateTransactionId: string;
  amount: number;
  counterparty: string;
  secondsApart: number;
}

export interface DecisionBrief {
  ticketId: string;
  relevantTransactionId: string | null;
  evidenceVerdict: EvidenceVerdict;
  caseType: CaseType;
  severity: Severity;
  department: Department;
  humanReviewRequired: boolean;
  replyLanguage: Language;
  userType?: UserType;
  transactionLabel?: string;
  transactionAmount?: number;
  transactionType?: TransactionType;
  transactionStatus?: TransactionStatus;
  counterparty?: string;
  recipientUnresponsive?: boolean;
  establishedRecipientPattern?: boolean;
  priorTransfersToCounterparty?: number;
  isAmbiguousMatch?: boolean;
  ambiguousMatchNote?: string;
  duplicatePair?: DuplicatePairBrief;
  mentionsBalanceDeducted?: boolean;
  isVagueComplaint?: boolean;
  credentialsNotShared?: boolean;
  recipientRelation?: string;
  complaintAmount?: number;
  serviceDescription?: string;
}

const PIN_OTP_WARNING_EN = 'Please do not share your PIN or OTP with anyone.';
const PIN_OTP_WARNING_BN = 'অনুগ্রহ করে কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।';

const SAFE_REFUND_LINE =
  'any eligible amount will be returned through official channels';

function pinOtpWarning(language: Language): string {
  return language === 'bn' ? PIN_OTP_WARNING_BN : PIN_OTP_WARNING_EN;
}

function txnRef(brief: DecisionBrief): string {
  return brief.relevantTransactionId ?? brief.transactionLabel ?? 'your transaction';
}

function amountBdt(brief: DecisionBrief): number | undefined {
  return brief.transactionAmount ?? brief.complaintAmount;
}

const SMALL_NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
] as const;

function smallNumberWord(value: number, capitalize = false): string {
  const word = SMALL_NUMBER_WORDS[value] ?? String(value);
  return capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

function wrongTransferAgentSummary(brief: DecisionBrief): string {
  if (brief.isAmbiguousMatch && brief.ambiguousMatchNote) {
    const amount = amountBdt(brief);
    const relation = brief.recipientRelation ?? 'recipient';
    const amountPart = amount !== undefined ? `a ${amount} BDT transfer to their ${relation}` : 'a transfer';
    return `Customer reports ${amountPart} was not received. ${brief.ambiguousMatchNote}. Cannot determine which is the ${relation}'s number without further input.`;
  }

  const txn = txnRef(brief);
  const amount = amountBdt(brief);
  const counterparty = brief.counterparty;

  if (brief.establishedRecipientPattern && amount !== undefined && counterparty !== undefined) {
    const totalTransfers = (brief.priorTransfersToCounterparty ?? 0) + 1;
    return `Customer claims ${txn} (${amount} BDT to ${counterparty}) was a wrong transfer, but transaction history shows ${smallNumberWord(totalTransfers)} prior transfers to the same counterparty in the past nine days, suggesting an established recipient.`;
  }

  if (
    brief.evidenceVerdict === 'consistent' &&
    amount !== undefined &&
    counterparty !== undefined
  ) {
    const unresponsiveNote = brief.recipientUnresponsive ? ' Recipient is unresponsive.' : '';
    return `Customer reports sending ${amount} BDT via ${txn} to ${counterparty}, which they now believe was the wrong recipient.${unresponsiveNote}`;
  }

  if (amount !== undefined && counterparty !== undefined) {
    return `Customer reports a wrong transfer of ${amount} BDT via ${txn} to ${counterparty}. Evidence is ${brief.evidenceVerdict}.`;
  }

  return `Customer reports a wrong transfer involving ${txn}. Evidence is ${brief.evidenceVerdict}.`;
}

function paymentFailedAgentSummary(brief: DecisionBrief): string {
  const txn = txnRef(brief);
  const amount = amountBdt(brief);
  const service = brief.serviceDescription ?? 'payment';

  if (amount !== undefined) {
    const balanceNote = brief.mentionsBalanceDeducted
      ? ' which failed, but reports balance was deducted. Requires payments operations investigation.'
      : ' which failed.';
    return `Customer attempted a ${amount} BDT ${service} (${txn})${balanceNote}`;
  }

  return `Customer reports a failed payment (${txn}) with possible balance deduction.`;
}

function refundRequestAgentSummary(brief: DecisionBrief): string {
  const txn = txnRef(brief);
  const amount = amountBdt(brief);
  const service = brief.serviceDescription ?? 'merchant payment';

  if (amount !== undefined) {
    return `Customer requests refund of ${amount} BDT for ${txn} (${service}) due to change of mind. Not a service failure.`;
  }

  return `Customer requests a refund related to ${txn}. Merchant policy may apply.`;
}

function duplicatePaymentAgentSummary(brief: DecisionBrief): string {
  const pair = brief.duplicatePair;
  if (pair) {
    const billType = brief.serviceDescription?.includes('electricity')
      ? 'electricity bill'
      : 'bill';
    return `Customer reports duplicate ${billType} payment. Two identical ${pair.amount} BDT payments to ${pair.counterparty} were completed ${pair.secondsApart} seconds apart (${pair.originalTransactionId} and ${pair.duplicateTransactionId}). The second is likely the duplicate.`;
  }

  return `Customer reports a possible duplicate payment for ${txnRef(brief)}.`;
}

function merchantSettlementAgentSummary(brief: DecisionBrief): string {
  const txn = txnRef(brief);
  const amount = amountBdt(brief);
  const statusNote =
    brief.transactionStatus === 'pending' ? ' Settlement status is pending.' : '';

  if (amount !== undefined) {
    return `Merchant reports yesterday's ${amount} BDT settlement (${txn}) is delayed beyond the standard 11 AM next-day window.${statusNote}`;
  }

  return `Merchant reports delayed settlement for ${txn}.${statusNote}`;
}

function agentCashInAgentSummary(brief: DecisionBrief): string {
  const txn = txnRef(brief);
  const amount = amountBdt(brief);
  const agent = brief.counterparty;

  if (amount !== undefined && agent !== undefined) {
    const statusNote =
      brief.transactionStatus === 'pending' ? ' Transaction status is pending.' : '';
    return `Customer reports ${amount} BDT cash-in via ${agent} (${txn}) not reflected in balance.${statusNote} Agent claims funds were sent.`;
  }

  return `Customer reports cash-in issue for ${txn} not reflected in balance.`;
}

function phishingAgentSummary(brief: DecisionBrief): string {
  const credentialsNote = brief.credentialsNotShared
    ? ' Customer has not yet shared credentials.'
    : '';
  return `Customer reports an unsolicited call claiming to be from the company and asking for OTP.${credentialsNote} Likely social engineering attempt.`;
}

function otherAgentSummary(brief: DecisionBrief): string {
  if (brief.isVagueComplaint || brief.evidenceVerdict === 'insufficient_data') {
    return 'Customer reports a vague concern about their money without specifying transaction, amount, or issue. Insufficient detail to identify any relevant transaction.';
  }

  return 'Customer submitted a support complaint requiring clarification or review.';
}

export function buildSafeAgentSummary(brief: DecisionBrief): string {
  switch (brief.caseType) {
    case 'wrong_transfer':
      return wrongTransferAgentSummary(brief);
    case 'payment_failed':
      return paymentFailedAgentSummary(brief);
    case 'refund_request':
      return refundRequestAgentSummary(brief);
    case 'duplicate_payment':
      return duplicatePaymentAgentSummary(brief);
    case 'merchant_settlement_delay':
      return merchantSettlementAgentSummary(brief);
    case 'agent_cash_in_issue':
      return agentCashInAgentSummary(brief);
    case 'phishing_or_social_engineering':
      return phishingAgentSummary(brief);
    default:
      return otherAgentSummary(brief);
  }
}

export function buildSafeRecommendedAction(brief: DecisionBrief): string {
  const txn = txnRef(brief);

  switch (brief.caseType) {
    case 'wrong_transfer':
      if (brief.isAmbiguousMatch) {
        return `Reply to customer asking for the ${brief.recipientRelation ?? 'recipient'}'s number to identify the correct transaction. Do not initiate dispute until the transaction is confirmed.`;
      }
      if (brief.establishedRecipientPattern) {
        return 'Flag for human review. Verify with the customer whether this was genuinely a wrong transfer given the established transaction pattern with this recipient.';
      }
      if (brief.evidenceVerdict === 'insufficient_data') {
        return 'Ask the customer for disambiguating details before initiating any dispute workflow.';
      }
      return `Verify ${txn} details with the customer and initiate the wrong-transfer dispute workflow per policy.`;
    case 'payment_failed':
      return `Investigate ${txn} ledger status. If balance was deducted on a failed payment, initiate the automatic reversal flow within standard SLA.`;
    case 'refund_request':
      return "Inform the customer that refund eligibility depends on the merchant's own policy. Provide guidance on contacting the merchant directly for a refund.";
    case 'duplicate_payment': {
      const duplicateTxn = brief.duplicatePair?.duplicateTransactionId ?? txn;
      return `Verify the duplicate with payments_ops. If the biller confirms only one payment was received, initiate reversal of ${duplicateTxn}.`;
    }
    case 'merchant_settlement_delay':
      return 'Route to merchant_operations to verify settlement batch status. If the batch is delayed, communicate a revised ETA to the merchant.';
    case 'agent_cash_in_issue':
      return `Investigate ${txn} pending status with agent operations. Confirm settlement state and resolve within the standard cash-in SLA.`;
    case 'phishing_or_social_engineering':
      return 'Escalate to fraud_risk team immediately. Confirm to customer that the company never asks for OTP. Log the reported number for fraud pattern analysis.';
    default:
      return 'Reply to customer asking for specific details: which transaction, what amount, what went wrong, and approximate time.';
  }
}

export function buildSafeCustomerReply(brief: DecisionBrief): string {
  const warn = pinOtpWarning(brief.replyLanguage);
  const txn = txnRef(brief);

  if (brief.replyLanguage === 'bn') {
    if (brief.caseType === 'phishing_or_social_engineering') {
      return `যোগাযোগ করার জন্য ধন্যবাদ। আমরা কোনো অবস্থাতেই ওটিপি বা পিন চাই না। ${warn}`;
    }
    if (brief.caseType === 'agent_cash_in_issue') {
      return `আপনার লেনদেন ${txn} এর বিষয়ে আমরা অবগত হয়েছি। আমাদের এজেন্ট অপারেশন্স দল এটি দ্রুত যাচাই করবে এবং অফিসিয়াল চ্যানেলে আপনাকে জানাবে। ${warn}`;
    }
    return `আপনার লেনদেন ${txn} এর বিষয়ে আমরা অবগত হয়েছি। আমাদের দল অফিসিয়াল চ্যানেলে যাচাই করবে। ${warn}`;
  }

  switch (brief.caseType) {
    case 'phishing_or_social_engineering':
      return `Thank you for reaching out before sharing any information. We never ask for your PIN, OTP, or password under any circumstances. Please do not share these with anyone, even if they claim to be from us. Our fraud team has been notified of this incident.`;
    case 'payment_failed':
      return `We have noted that transaction ${txn} may have caused an unexpected balance deduction. Our payments team will review the case and ${SAFE_REFUND_LINE}. ${warn}`;
    case 'duplicate_payment':
      return `We have noted the possible duplicate payment for transaction ${txn}. Our payments team will verify with the biller and ${SAFE_REFUND_LINE}. ${warn}`;
    case 'refund_request':
      return `Thank you for reaching out. Refunds for completed merchant payments depend on the merchant's own policy. We recommend contacting the merchant directly. If you need help reaching them, please reply and we will guide you. ${warn}`;
    case 'merchant_settlement_delay':
      return `We have noted your concern about settlement ${txn}. Our merchant operations team will check the batch status and update you on the expected settlement time through official channels.`;
    case 'wrong_transfer':
      if (brief.establishedRecipientPattern) {
        return `We have received your request regarding transaction ${txn}. ${warn} Our dispute team will review the case carefully and contact you through official support channels.`;
      }
      if (brief.isAmbiguousMatch) {
        const amount = amountBdt(brief);
        const amountPart = amount !== undefined ? `multiple transactions of ${amount} BDT` : 'multiple transactions';
        return `Thank you for reaching out. We see ${amountPart} on that date. Could you share your ${brief.recipientRelation ?? 'recipient'}'s number so we can identify the right transaction? ${warn}`;
      }
      return `We have noted your concern about transaction ${txn}. ${warn} Our dispute team will review the case and contact you through official support channels.`;
    case 'agent_cash_in_issue':
      return `We have noted your concern about transaction ${txn}. Our agent operations team will verify the case and update you through official channels. ${warn}`;
    default:
      return `Thank you for reaching out. To help you faster, please share the transaction ID, the amount involved, and a short description of what went wrong. ${warn}`;
  }
}

export function buildSafeProse(brief: DecisionBrief): ProseFields {
  return {
    agentSummary: buildSafeAgentSummary(brief),
    recommendedNextAction: buildSafeRecommendedAction(brief),
    customerReply: buildSafeCustomerReply(brief),
  };
}

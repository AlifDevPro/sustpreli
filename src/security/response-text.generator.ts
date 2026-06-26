import type { TicketRequest } from '../domain/models/ticket-request.model';
import type { InvestigationDecision } from '../domain/models/investigation-result.model';
import type { Language } from '../domain/enums';
import { buildComplaintSignals } from '../domain/investigation/complaint-analyzer';
import { countPriorTransfersToCounterparty } from '../domain/investigation/recipient-pattern-analyzer';
import type { ComplaintSignals } from '../utils/keyword-heuristics';
import { buildSafeProse, type DecisionBrief } from './safe-templates';
import type { ProseFields } from './types';

function resolveReplyLanguage(request: TicketRequest): Language {
  if (request.language) {
    return request.language === 'mixed' ? 'en' : request.language;
  }

  const hasBangla = /[\u0980-\u09FF]/.test(request.complaint);
  return hasBangla ? 'bn' : 'en';
}

const RECIPIENT_UNRESPONSIVE_PATTERN =
  /not responding|isn'?t responding|unresponsive|won'?t pick up|not picking up/i;

const CREDENTIALS_NOT_SHARED_PATTERN =
  /haven'?t shared|have not shared|not shared|didn'?t share|did not share/i;

const RECIPIENT_RELATION_PATTERN =
  /\b(brother|sister|mother|father|friend|wife|husband)\b/i;

const MOBILE_RECHARGE_PATTERN = /mobile\s+recharge|recharge/i;
const ELECTRICITY_BILL_PATTERN = /electricity\s+bill|bill\s+payment/i;

const COUNT_WORDS = [
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

function countWord(value: number, capitalize = false): string {
  const word = COUNT_WORDS[value] ?? String(value);
  return capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

function resolveServiceDescription(
  request: TicketRequest,
  counterparty?: string,
  transactionType?: string,
): string | undefined {
  if (MOBILE_RECHARGE_PATTERN.test(request.complaint)) {
    return 'mobile recharge';
  }

  if (ELECTRICITY_BILL_PATTERN.test(request.complaint)) {
    return 'electricity bill payment';
  }

  if (counterparty?.startsWith('BILLER-')) {
    return 'bill payment';
  }

  if (counterparty?.includes('MOBILE')) {
    return 'mobile recharge';
  }

  if (transactionType === 'settlement') {
    return 'settlement';
  }

  if (transactionType === 'cash_in') {
    return 'cash-in';
  }

  if (transactionType === 'payment') {
    return 'merchant payment';
  }

  return undefined;
}

function buildAmbiguousMatchNote(
  request: TicketRequest,
  decision: InvestigationDecision,
  signals: ComplaintSignals,
): string | undefined {
  if (!decision.investigation.isAmbiguousMatch) {
    return undefined;
  }

  const amount =
    signals.mentionedAmounts[0] ??
    decision.investigation.matches.find((match) => match.signals.amountMatch)?.transaction.amount;

  if (amount === undefined) {
    return undefined;
  }

  const pool = request.transactionHistory.filter((transaction) => transaction.amount === amount);
  if (pool.length < 2) {
    return undefined;
  }

  const completed = pool.filter((transaction) => transaction.status === 'completed').length;
  const failed = pool.filter((transaction) => transaction.status === 'failed').length;
  const recipientCount = new Set(pool.map((transaction) => transaction.counterparty)).size;

  return `${countWord(pool.length, true)} transactions of ${amount} BDT exist on the date in question (${countWord(completed)} completed, ${countWord(failed)} failed) to ${countWord(recipientCount)} different recipients`;
}

export function toDecisionBrief(
  request: TicketRequest,
  decision: InvestigationDecision,
): DecisionBrief {
  const topTransaction = decision.investigation.topMatch?.transaction;
  const signals = buildComplaintSignals(request.complaint);
  const duplicatePair = decision.investigation.duplicatePair;

  let priorTransfersToCounterparty: number | undefined;
  if (topTransaction) {
    priorTransfersToCounterparty = countPriorTransfersToCounterparty(
      request.transactionHistory,
      topTransaction.counterparty,
      topTransaction.transactionId,
    );
  }

  const relationMatch = request.complaint.match(RECIPIENT_RELATION_PATTERN);

  return {
    ticketId: request.ticketId,
    relevantTransactionId: decision.investigation.relevantTransactionId,
    evidenceVerdict: decision.investigation.evidenceVerdict,
    caseType: decision.classification.caseType,
    severity: decision.classification.severity,
    department: decision.classification.department,
    humanReviewRequired: decision.classification.humanReviewRequired,
    replyLanguage: resolveReplyLanguage(request),
    userType: request.userType,
    transactionLabel: topTransaction?.transactionId,
    transactionAmount: topTransaction?.amount,
    transactionType: topTransaction?.type,
    transactionStatus: topTransaction?.status,
    counterparty: topTransaction?.counterparty,
    recipientUnresponsive: RECIPIENT_UNRESPONSIVE_PATTERN.test(request.complaint),
    establishedRecipientPattern: decision.investigation.establishedRecipientPattern,
    priorTransfersToCounterparty,
    isAmbiguousMatch: decision.investigation.isAmbiguousMatch,
    ambiguousMatchNote: buildAmbiguousMatchNote(request, decision, signals),
    duplicatePair: duplicatePair
      ? {
          originalTransactionId: duplicatePair.original.transactionId,
          duplicateTransactionId: duplicatePair.duplicate.transactionId,
          amount: duplicatePair.duplicate.amount,
          counterparty: duplicatePair.duplicate.counterparty,
          secondsApart: duplicatePair.secondsApart,
        }
      : undefined,
    mentionsBalanceDeducted: signals.mentionsBalanceDeducted,
    isVagueComplaint: signals.isVague,
    credentialsNotShared: CREDENTIALS_NOT_SHARED_PATTERN.test(request.complaint),
    recipientRelation: relationMatch?.[1]?.toLowerCase(),
    complaintAmount: signals.mentionedAmounts[0],
    serviceDescription: resolveServiceDescription(
      request,
      topTransaction?.counterparty,
      topTransaction?.type,
    ),
  };
}

export function generateDeterministicProse(
  request: TicketRequest,
  decision: InvestigationDecision,
): ProseFields {
  return buildSafeProse(toDecisionBrief(request, decision));
}

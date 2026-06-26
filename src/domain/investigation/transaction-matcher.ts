import { INVESTIGATION_CONSTANTS } from '../../config/constants';
import type { Transaction } from '../../domain/models/ticket-request.model';
import type { TransactionMatch, MatchSignals } from '../../domain/models/investigation-result.model';
import type { ComplaintSignals } from '../../utils/keyword-heuristics';
import { parseIso8601UtcTimestamp } from '../../utils/timestamp-validator';

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('880')) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return `88${digits}`;
  }

  return digits;
}

function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

function scoreTransaction(
  transaction: Transaction,
  signals: ComplaintSignals,
  referenceTimestamp?: string,
): TransactionMatch {
  const signalsResult: MatchSignals = {
    amountMatch: false,
    transactionIdMatch: false,
    counterpartyMatch: false,
    typeMatch: false,
    statusMatch: false,
    timeMatch: false,
  };

  let score = 0;

  if (signals.mentionedTransactionIds.includes(transaction.transactionId.toUpperCase())) {
    signalsResult.transactionIdMatch = true;
    score += 0.5;
  }

  if (
    signals.mentionedAmounts.length === 0 ||
    signals.mentionedAmounts.includes(transaction.amount)
  ) {
    if (signals.mentionedAmounts.includes(transaction.amount)) {
      signalsResult.amountMatch = true;
      score += 0.35;
    } else if (signals.mentionedAmounts.length === 0) {
      score += 0.05;
    }
  }

  if (
    signals.mentionedPhoneNumbers.some((phone) => phonesMatch(phone, transaction.counterparty))
  ) {
    signalsResult.counterpartyMatch = true;
    score += 0.3;
  }

  if (signals.isCashInIssue && transaction.type === 'cash_in') {
    signalsResult.typeMatch = true;
    score += 0.15;
  }

  if (signals.isSettlementDelay && transaction.type === 'settlement') {
    signalsResult.typeMatch = true;
    score += 0.2;
  }

  if (signals.isPaymentFailed && transaction.type === 'payment' && transaction.status === 'failed') {
    signalsResult.typeMatch = true;
    signalsResult.statusMatch = true;
    score += 0.25;
  }

  if (signals.isWrongTransfer && transaction.type === 'transfer') {
    signalsResult.typeMatch = true;
    score += 0.1;
  }

  if (signals.isDuplicatePayment && transaction.type === 'payment') {
    signalsResult.typeMatch = true;
    score += 0.1;
  }

  if (signals.isRefundRequest && transaction.type === 'payment' && transaction.status === 'completed') {
    signalsResult.typeMatch = true;
    signalsResult.statusMatch = true;
    score += 0.15;
  }

  if (referenceTimestamp) {
    const ref = parseIso8601UtcTimestamp(referenceTimestamp);
    const txTime = parseIso8601UtcTimestamp(transaction.timestamp);
    if (ref && txTime) {
      const diffHours = Math.abs(ref.getTime() - txTime.getTime()) / (1000 * 60 * 60);
      if (diffHours <= INVESTIGATION_CONSTANTS.TIME_MATCH_TOLERANCE_HOURS) {
        signalsResult.timeMatch = true;
        score += 0.05;
      }
    }
  }

  return {
    transaction,
    score: Math.min(score, 1),
    signals: signalsResult,
  };
}

export function matchTransactions(
  history: Transaction[],
  signals: ComplaintSignals,
  referenceTimestamp?: string,
): TransactionMatch[] {
  return history
    .map((transaction) => scoreTransaction(transaction, signals, referenceTimestamp))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        parseIso8601UtcTimestamp(b.transaction.timestamp)!.getTime() -
        parseIso8601UtcTimestamp(a.transaction.timestamp)!.getTime()
      );
    });
}

export function selectTopMatch(matches: TransactionMatch[]): TransactionMatch | null {
  if (matches.length === 0) {
    return null;
  }

  return matches[0] ?? null;
}

export function isAmbiguousMatch(
  matches: TransactionMatch[],
  signals: ComplaintSignals,
): boolean {
  if (matches.length < 2) {
    return false;
  }

  const amountMatches = matches.filter(
    (match) =>
      signals.mentionedAmounts.includes(match.transaction.amount) ||
      (signals.mentionedAmounts.length === 0 && match.signals.amountMatch),
  );

  const candidatePool =
    signals.mentionedAmounts.length > 0
      ? matches.filter((match) => signals.mentionedAmounts.includes(match.transaction.amount))
      : matches.filter((match) => match.score >= INVESTIGATION_CONSTANTS.STRONG_MATCH_SCORE_THRESHOLD * 0.8);

  if (candidatePool.length < 2) {
    return false;
  }

  const [first, second] = candidatePool;
  if (!first || !second) {
    return false;
  }

  const sameAmount = first.transaction.amount === second.transaction.amount;
  const sameType = first.transaction.type === second.transaction.type;
  const differentCounterparty = first.transaction.counterparty !== second.transaction.counterparty;

  if (sameAmount && sameType && differentCounterparty) {
    return true;
  }

  if (amountMatches.length >= 2 && signals.mentionsNotReceived) {
    const uniqueCounterparties = new Set(amountMatches.map((match) => match.transaction.counterparty));
    return uniqueCounterparties.size >= 2;
  }

  const scoreDelta = first.score - second.score;
  return (
    first.score >= INVESTIGATION_CONSTANTS.STRONG_MATCH_SCORE_THRESHOLD &&
    scoreDelta <= INVESTIGATION_CONSTANTS.AMBIGUOUS_MATCH_SCORE_DELTA &&
    sameAmount &&
    sameType
  );
}

export function findMatchesByAmount(history: Transaction[], amount: number): Transaction[] {
  return history.filter((transaction) => transaction.amount === amount);
}

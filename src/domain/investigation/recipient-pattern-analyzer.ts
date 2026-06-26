import { INVESTIGATION_CONSTANTS } from '../../config/constants';
import type { Transaction } from '../../domain/models/ticket-request.model';
import { parseIso8601UtcTimestamp } from '../../utils/timestamp-validator';

export function countPriorTransfersToCounterparty(
  history: Transaction[],
  counterparty: string,
  excludeTransactionId?: string,
  referenceTimestamp?: string,
): number {
  const referenceMs = referenceTimestamp
    ? (parseIso8601UtcTimestamp(referenceTimestamp)?.getTime() ?? Date.now())
    : Math.max(
        ...history.map(
          (transaction) => parseIso8601UtcTimestamp(transaction.timestamp)?.getTime() ?? 0,
        ),
      );

  const cutoff = referenceMs - INVESTIGATION_CONSTANTS.ESTABLISHED_RECIPIENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  return history.filter((transaction) => {
    if (transaction.transactionId === excludeTransactionId) {
      return false;
    }

    if (transaction.type !== 'transfer' || transaction.counterparty !== counterparty) {
      return false;
    }

    const timestamp = parseIso8601UtcTimestamp(transaction.timestamp);
    if (!timestamp) {
      return false;
    }

    return timestamp.getTime() >= cutoff;
  }).length;
}

export function hasEstablishedRecipientPattern(
  history: Transaction[],
  counterparty: string,
  excludeTransactionId?: string,
  referenceTimestamp?: string,
): boolean {
  const count = countPriorTransfersToCounterparty(
    history,
    counterparty,
    excludeTransactionId,
    referenceTimestamp,
  );
  return count >= INVESTIGATION_CONSTANTS.ESTABLISHED_RECIPIENT_MIN_COUNT;
}

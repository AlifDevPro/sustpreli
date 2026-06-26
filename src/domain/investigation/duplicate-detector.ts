import { INVESTIGATION_CONSTANTS } from '../../config/constants';
import type { Transaction } from '../../domain/models/ticket-request.model';
import type { DuplicatePaymentPair } from '../../domain/models/investigation-result.model';
import { parseIso8601UtcTimestamp } from '../../utils/timestamp-validator';

function secondsBetween(a: string, b: string): number {
  const dateA = parseIso8601UtcTimestamp(a);
  const dateB = parseIso8601UtcTimestamp(b);
  if (!dateA || !dateB) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(dateA.getTime() - dateB.getTime()) / 1000;
}

function areDuplicateCandidates(a: Transaction, b: Transaction): boolean {
  return (
    a.type === 'payment' &&
    b.type === 'payment' &&
    a.status === 'completed' &&
    b.status === 'completed' &&
    a.amount === b.amount &&
    a.counterparty === b.counterparty
  );
}

export function detectDuplicatePayment(history: Transaction[]): DuplicatePaymentPair | null {
  const sorted = [...history].sort((a, b) => {
    const ta = parseIso8601UtcTimestamp(a.timestamp)?.getTime() ?? 0;
    const tb = parseIso8601UtcTimestamp(b.timestamp)?.getTime() ?? 0;
    return ta - tb;
  });

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const first = sorted[i];
      const second = sorted[j];
      if (!first || !second) {
        continue;
      }

      if (!areDuplicateCandidates(first, second)) {
        continue;
      }

      const secondsApart = secondsBetween(first.timestamp, second.timestamp);
      if (secondsApart <= INVESTIGATION_CONSTANTS.DUPLICATE_PAYMENT_WINDOW_SECONDS) {
        return {
          original: first,
          duplicate: second,
          secondsApart,
        };
      }
    }
  }

  return null;
}

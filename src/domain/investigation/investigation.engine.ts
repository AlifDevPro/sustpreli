import { parseIso8601UtcTimestamp } from '../../utils/timestamp-validator';
import type { TicketRequest } from '../models/ticket-request.model';
import type { InvestigationResult } from '../models/investigation-result.model';
import type { ComplaintSignals } from '../../utils/keyword-heuristics';
import { buildComplaintSignals } from './complaint-analyzer';
import { detectDuplicatePayment } from './duplicate-detector';
import { evaluateEvidence, mergeEvidenceIntoResult } from './evidence-engine';
import { hasEstablishedRecipientPattern } from './recipient-pattern-analyzer';
import {
  isAmbiguousMatch,
  matchTransactions,
  selectTopMatch,
} from './transaction-matcher';

export class InvestigationEngine {
  investigate(request: TicketRequest, signals?: ComplaintSignals): InvestigationResult {
    const complaintSignals = signals ?? buildComplaintSignals(request.complaint);
    const history = request.transactionHistory;
    const referenceTimestamp = history.reduce<string | undefined>((latest, transaction) => {
      if (!latest) {
        return transaction.timestamp;
      }

      const latestDate = parseIso8601UtcTimestamp(latest);
      const currentDate = parseIso8601UtcTimestamp(transaction.timestamp);
      if (!latestDate || !currentDate) {
        return latest;
      }

      return currentDate.getTime() > latestDate.getTime() ? transaction.timestamp : latest;
    }, undefined);

    const duplicatePair = detectDuplicatePayment(history);
    const matches = matchTransactions(history, complaintSignals, referenceTimestamp);
    const topMatch = selectTopMatch(matches);
    const ambiguous = isAmbiguousMatch(matches, complaintSignals);

    const establishedRecipientPattern =
      topMatch !== null &&
      complaintSignals.isWrongTransfer &&
      hasEstablishedRecipientPattern(
        history,
        topMatch.transaction.counterparty,
        topMatch.transaction.transactionId,
        referenceTimestamp,
      );

    const baseResult: InvestigationResult = {
      relevantTransactionId: null,
      evidenceVerdict: 'insufficient_data',
      matches,
      topMatch,
      duplicatePair,
      establishedRecipientPattern,
      isAmbiguousMatch: ambiguous,
      ambiguityReason: null,
      investigationNotes: [],
    };

    const evaluation = evaluateEvidence({
      signals: complaintSignals,
      topMatch,
      isAmbiguousMatch: ambiguous,
      establishedRecipientPattern,
      hasDuplicatePair: duplicatePair !== null,
      historyEmpty: history.length === 0,
    });

    const duplicateTransactionId = duplicatePair?.duplicate.transactionId ?? null;

    return mergeEvidenceIntoResult(baseResult, evaluation, duplicateTransactionId);
  }
}

export const investigationEngine = new InvestigationEngine();

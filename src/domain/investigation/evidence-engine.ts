import type { EvidenceVerdict } from '../../domain/enums/investigation.enums';
import type {
  InvestigationResult,
  TransactionMatch,
} from '../../domain/models/investigation-result.model';
import type { ComplaintSignals } from '../../utils/keyword-heuristics';

export interface EvidenceEvaluationInput {
  signals: ComplaintSignals;
  topMatch: TransactionMatch | null;
  isAmbiguousMatch: boolean;
  establishedRecipientPattern: boolean;
  hasDuplicatePair: boolean;
  historyEmpty: boolean;
}

export function evaluateEvidence(input: EvidenceEvaluationInput): {
  verdict: EvidenceVerdict;
  relevantTransactionId: string | null;
  ambiguityReason: string | null;
  notes: string[];
} {
  const notes: string[] = [];
  const { signals, topMatch, isAmbiguousMatch, establishedRecipientPattern, hasDuplicatePair } =
    input;

  if (signals.isPhishingReport) {
    notes.push('Phishing or social engineering report — no transaction verification applicable.');
    return {
      verdict: 'insufficient_data',
      relevantTransactionId: null,
      ambiguityReason: null,
      notes,
    };
  }

  if (signals.isVague) {
    notes.push('Complaint lacks specific transaction, amount, or issue details.');
    return {
      verdict: 'insufficient_data',
      relevantTransactionId: null,
      ambiguityReason: 'vague_complaint',
      notes,
    };
  }

  if (hasDuplicatePair) {
    notes.push('Duplicate payment pattern detected in transaction history.');
    return {
      verdict: 'consistent',
      relevantTransactionId: null, // set by investigation engine from duplicate pair
      ambiguityReason: null,
      notes,
    };
  }

  if (isAmbiguousMatch) {
    notes.push('Multiple transactions plausibly match the complaint.');
    return {
      verdict: 'insufficient_data',
      relevantTransactionId: null,
      ambiguityReason: 'ambiguous_match',
      notes,
    };
  }

  if (!topMatch) {
    if (input.historyEmpty) {
      notes.push('No transaction history provided to verify the complaint.');
    } else {
      notes.push('No transaction in history matches the complaint details.');
    }

    return {
      verdict: 'insufficient_data',
      relevantTransactionId: null,
      ambiguityReason: input.historyEmpty ? 'empty_history' : 'no_match',
      notes,
    };
  }

  const transaction = topMatch.transaction;

  if (signals.isWrongTransfer && establishedRecipientPattern) {
    notes.push(
      `Customer claims wrong transfer but ${transaction.counterparty} is an established recipient.`,
    );
    return {
      verdict: 'inconsistent',
      relevantTransactionId: transaction.transactionId,
      ambiguityReason: null,
      notes,
    };
  }

  if (signals.isPaymentFailed && transaction.status === 'completed' && !signals.mentionsBalanceDeducted) {
    notes.push('Customer reports payment failure but transaction status is completed.');
    return {
      verdict: 'inconsistent',
      relevantTransactionId: transaction.transactionId,
      ambiguityReason: null,
      notes,
    };
  }

  if (
    signals.mentionsNotReceived &&
    transaction.type === 'transfer' &&
    transaction.status === 'completed'
  ) {
    notes.push('Transfer marked completed but customer reports non-receipt — needs clarification.');
    if (isAmbiguousMatch) {
      return {
        verdict: 'insufficient_data',
        relevantTransactionId: null,
        ambiguityReason: 'ambiguous_match',
        notes,
      };
    }
  }

  if (signals.isWrongTransfer || signals.isPaymentFailed || signals.isCashInIssue) {
    notes.push('Complaint details align with the identified transaction.');
    return {
      verdict: 'consistent',
      relevantTransactionId: transaction.transactionId,
      ambiguityReason: null,
      notes,
    };
  }

  if (signals.isSettlementDelay && transaction.type === 'settlement') {
    notes.push('Settlement delay complaint aligns with pending settlement transaction.');
    return {
      verdict: 'consistent',
      relevantTransactionId: transaction.transactionId,
      ambiguityReason: null,
      notes,
    };
  }

  if (signals.isRefundRequest && transaction.status === 'completed') {
    notes.push('Refund request references a completed payment transaction.');
    return {
      verdict: 'consistent',
      relevantTransactionId: transaction.transactionId,
      ambiguityReason: null,
      notes,
    };
  }

  if (signals.isDuplicatePayment) {
    notes.push('Duplicate payment claim with matching transaction evidence.');
    return {
      verdict: 'consistent',
      relevantTransactionId: transaction.transactionId,
      ambiguityReason: null,
      notes,
    };
  }

  if (topMatch.score >= 0.35) {
    notes.push('Transaction match score sufficient for consistent evidence assessment.');
    return {
      verdict: 'consistent',
      relevantTransactionId: transaction.transactionId,
      ambiguityReason: null,
      notes,
    };
  }

  notes.push('Insufficient evidence to confirm complaint against transaction history.');
  return {
    verdict: 'insufficient_data',
    relevantTransactionId: null,
    ambiguityReason: 'weak_match',
    notes,
  };
}

export function mergeEvidenceIntoResult(
  result: InvestigationResult,
  evaluation: ReturnType<typeof evaluateEvidence>,
  duplicateTransactionId: string | null,
): InvestigationResult {
  const isAmbiguous =
    result.isAmbiguousMatch || evaluation.ambiguityReason === 'ambiguous_match';

  const relevantTransactionId = isAmbiguous
    ? null
    : duplicateTransactionId ?? evaluation.relevantTransactionId;

  return {
    ...result,
    relevantTransactionId,
    evidenceVerdict: isAmbiguous ? 'insufficient_data' : evaluation.verdict,
    ambiguityReason: isAmbiguous ? 'ambiguous_match' : evaluation.ambiguityReason,
    investigationNotes: [...result.investigationNotes, ...evaluation.notes],
  };
}

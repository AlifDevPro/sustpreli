import type { Transaction } from './ticket-request.model';
import type {
  CaseType,
  Department,
  EvidenceVerdict,
  Severity,
} from '../enums/investigation.enums';

export interface MatchSignals {
  amountMatch: boolean;
  transactionIdMatch: boolean;
  counterpartyMatch: boolean;
  typeMatch: boolean;
  statusMatch: boolean;
  timeMatch: boolean;
}

export interface TransactionMatch {
  transaction: Transaction;
  score: number;
  signals: MatchSignals;
}

export interface DuplicatePaymentPair {
  original: Transaction;
  duplicate: Transaction;
  secondsApart: number;
}

export interface InvestigationResult {
  relevantTransactionId: string | null;
  evidenceVerdict: EvidenceVerdict;
  matches: TransactionMatch[];
  topMatch: TransactionMatch | null;
  duplicatePair: DuplicatePaymentPair | null;
  establishedRecipientPattern: boolean;
  isAmbiguousMatch: boolean;
  ambiguityReason: string | null;
  investigationNotes: string[];
}

export interface ClassificationResult {
  caseType: CaseType;
  severity: Severity;
  department: Department;
  humanReviewRequired: boolean;
  confidence: number;
  reasonCodes: string[];
}

export interface InvestigationDecision {
  investigation: InvestigationResult;
  classification: ClassificationResult;
}

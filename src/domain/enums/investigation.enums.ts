export type EvidenceVerdict = 'consistent' | 'inconsistent' | 'insufficient_data';

export type CaseType =
  | 'wrong_transfer'
  | 'payment_failed'
  | 'refund_request'
  | 'duplicate_payment'
  | 'merchant_settlement_delay'
  | 'agent_cash_in_issue'
  | 'phishing_or_social_engineering'
  | 'other';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type Department =
  | 'customer_support'
  | 'dispute_resolution'
  | 'payments_ops'
  | 'merchant_operations'
  | 'agent_operations'
  | 'fraud_risk';

export const EVIDENCE_VERDICTS = [
  'consistent',
  'inconsistent',
  'insufficient_data',
] as const satisfies readonly EvidenceVerdict[];

export const CASE_TYPES = [
  'wrong_transfer',
  'payment_failed',
  'refund_request',
  'duplicate_payment',
  'merchant_settlement_delay',
  'agent_cash_in_issue',
  'phishing_or_social_engineering',
  'other',
] as const satisfies readonly CaseType[];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const satisfies readonly Severity[];

export const DEPARTMENTS = [
  'customer_support',
  'dispute_resolution',
  'payments_ops',
  'merchant_operations',
  'agent_operations',
  'fraud_risk',
] as const satisfies readonly Department[];

export const HEALTH_RESPONSE = { status: 'ok' } as const;

export const API_ROUTES = {
  HEALTH: '/health',
  ANALYZE_TICKET: '/analyze-ticket',
} as const;

/** Validation limits — align with express.json body limit where applicable */
export const VALIDATION_LIMITS = {
  MAX_COMPLAINT_LENGTH: 10_000,
  MAX_TICKET_ID_LENGTH: 128,
  MAX_CAMPAIGN_CONTEXT_LENGTH: 256,
  MAX_COUNTERPARTY_LENGTH: 256,
  MAX_TRANSACTION_ID_LENGTH: 128,
  MAX_TRANSACTION_HISTORY_ENTRIES: 50,
  MAX_METADATA_KEYS: 50,
  MAX_METADATA_DEPTH: 3,
  MAX_STRING_FIELD_LENGTH: 2_000,
} as const;

export const FORBIDDEN_OBJECT_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

export const VALIDATION_ISSUE_CODES = {
  EMPTY_COMPLAINT: 'empty_complaint',
  FORBIDDEN_KEY: 'forbidden_key',
  INVALID_TIMESTAMP: 'invalid_timestamp',
  INVALID_AMOUNT: 'invalid_amount',
  DUPLICATE_TRANSACTION_ID: 'duplicate_transaction_id',
} as const;

/** Investigation engine tuning */
export const INVESTIGATION_CONSTANTS = {
  DUPLICATE_PAYMENT_WINDOW_SECONDS: 60,
  ESTABLISHED_RECIPIENT_MIN_COUNT: 2,
  ESTABLISHED_RECIPIENT_LOOKBACK_DAYS: 14,
  TIME_MATCH_TOLERANCE_HOURS: 6,
  HIGH_VALUE_THRESHOLD_BDT: 10_000,
  VAGUE_COMPLAINT_MAX_WORDS: 10,
  AMBIGUOUS_MATCH_SCORE_DELTA: 0.05,
  STRONG_MATCH_SCORE_THRESHOLD: 0.55,
} as const;

export const CONFIDENCE_CONSTANTS = {
  BASE: 0.5,
  AMOUNT_MATCH: 0.15,
  TXN_ID_MATCH: 0.25,
  TYPE_STATUS_MATCH: 0.1,
  TIME_MATCH: 0.1,
  COUNTERPARTY_MATCH: 0.1,
  DUPLICATE_DETECTED: 0.2,
  PHISHING_CLEAR: 0.4,
  AMBIGUITY_PENALTY: 0.2,
  VAGUE_PENALTY: 0.25,
  INCONSISTENT_PENALTY: 0.15,
  NO_HISTORY_PENALTY: 0.05,
  CONSISTENT_EVIDENCE_BONUS: 0.05,
  MIN: 0,
  MAX: 1,
} as const;

export const CASE_TYPE_TO_DEPARTMENT = {
  wrong_transfer: 'dispute_resolution',
  payment_failed: 'payments_ops',
  refund_request: 'customer_support',
  duplicate_payment: 'payments_ops',
  merchant_settlement_delay: 'merchant_operations',
  agent_cash_in_issue: 'agent_operations',
  phishing_or_social_engineering: 'fraud_risk',
  other: 'customer_support',
} as const;

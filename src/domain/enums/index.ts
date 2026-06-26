export const LANGUAGES = ['en', 'bn', 'mixed'] as const;
export const CHANNELS = [
  'in_app_chat',
  'call_center',
  'email',
  'merchant_portal',
  'field_agent',
] as const;
export const USER_TYPES = ['customer', 'merchant', 'agent', 'unknown'] as const;
export const TRANSACTION_TYPES = [
  'transfer',
  'payment',
  'cash_in',
  'cash_out',
  'settlement',
  'refund',
] as const;
export const TRANSACTION_STATUSES = ['completed', 'failed', 'pending', 'reversed'] as const;

export type Language = (typeof LANGUAGES)[number];
export type Channel = (typeof CHANNELS)[number];
export type UserType = (typeof USER_TYPES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

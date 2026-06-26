/**
 * Patterns that must never appear in customer-facing or agent-facing output.
 * Organized by penalty category from the hackathon rubric.
 */

export interface ForbiddenPattern {
  id: string;
  pattern: RegExp;
  category: 'credential_request' | 'unauthorized_refund' | 'account_recovery' | 'third_party_direction';
}

export const CREDENTIAL_TERMS =
  /\b(pin|otp|one[-\s]?time\s+password|password|card\s*number|full\s+card|cvv|cvc|security\s+code)\b/i;

export const CREDENTIAL_REQUEST_PATTERNS: ForbiddenPattern[] = [
  {
    id: 'ask_share_pin_otp',
    pattern:
      /\b(share|provide|send|give|tell|confirm|enter|submit|verify\s+with)\b[^.]{0,40}\b(pin|otp|password|card\s*number|cvv|cvc|security\s+code)\b/i,
    category: 'credential_request',
  },
  {
    id: 'please_your_credential',
    pattern:
      /\b(your|the)\s+(pin|otp|password|card\s*number|cvv|cvc|security\s+code)\b/i,
    category: 'credential_request',
  },
  {
    id: 'credential_for_verification',
    pattern:
      /\b(pin|otp|password|card\s*number|cvv|cvc|security\s+code)\b[^.]{0,30}\b(verification|verify|security\s+step)\b/i,
    category: 'credential_request',
  },
  {
    id: 'ask_customer_otp',
    pattern: /\bask\b[^.]{0,30}\b(pin|otp|password)\b/i,
    category: 'credential_request',
  },
];

export const UNAUTHORIZED_REFUND_PATTERNS: ForbiddenPattern[] = [
  {
    id: 'we_will_refund',
    pattern: /\bwe\s+will\s+refund\b/i,
    category: 'unauthorized_refund',
  },
  {
    id: 'refund_confirmed',
    pattern: /\b(refund|payment)\s+(has\s+been\s+|is\s+)?confirmed\b/i,
    category: 'unauthorized_refund',
  },
  {
    id: 'money_returned_to_you',
    pattern: /\bmoney\s+will\s+be\s+returned\s+to\s+you\b/i,
    category: 'unauthorized_refund',
  },
  {
    id: 'has_been_reversed',
    pattern: /\b(has\s+been\s+)?reversed\b/i,
    category: 'unauthorized_refund',
  },
  {
    id: 'we_have_refunded',
    pattern: /\bwe\s+have\s+refunded\b/i,
    category: 'unauthorized_refund',
  },
  {
    id: 'guaranteed_refund',
    pattern: /\bguaranteed\s+refund\b/i,
    category: 'unauthorized_refund',
  },
];

export const ACCOUNT_RECOVERY_PATTERNS: ForbiddenPattern[] = [
  {
    id: 'account_unblocked',
    pattern: /\baccount\s+(has\s+been\s+)?unblocked\b/i,
    category: 'account_recovery',
  },
  {
    id: 'we_will_unlock',
    pattern: /\bwe\s+will\s+unlock\b/i,
    category: 'account_recovery',
  },
  {
    id: 'account_unlocked',
    pattern: /\baccount\s+(has\s+been\s+)?unlocked\b/i,
    category: 'account_recovery',
  },
  {
    id: 'recovery_complete',
    pattern: /\brecovery\s+(is\s+)?complete\b/i,
    category: 'account_recovery',
  },
  {
    id: 'funds_recovered',
    pattern: /\bfunds?\s+have\s+been\s+recovered\b/i,
    category: 'account_recovery',
  },
  {
    id: 'we_will_recover',
    pattern: /\bwe\s+will\s+recover\b/i,
    category: 'account_recovery',
  },
];

export const THIRD_PARTY_PATTERNS: ForbiddenPattern[] = [
  {
    id: 'contact_this_number',
    pattern: /\b(contact|call|whatsapp|text)\s+(this|the following)\s+(\+?\d{6,}|number)\b/i,
    category: 'third_party_direction',
  },
  {
    id: 'call_external_agent',
    pattern: /\bcall\s+\+?\d{10,}\b/i,
    category: 'third_party_direction',
  },
  {
    id: 'visit_external_url',
    pattern: /\b(visit|go\s+to)\s+(http|www\.)/i,
    category: 'third_party_direction',
  },
];

export const ALL_OUTPUT_FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  ...CREDENTIAL_REQUEST_PATTERNS,
  ...UNAUTHORIZED_REFUND_PATTERNS,
  ...ACCOUNT_RECOVERY_PATTERNS,
  ...THIRD_PARTY_PATTERNS,
];

/** Safe phrases explicitly allowed even when they mention refunds indirectly */
export const SAFE_REFUND_PHRASE =
  /any\s+eligible\s+amount\s+will\s+be\s+returned\s+through\s+official\s+channels/i;

export const SAFE_CREDENTIAL_PHRASES = [
  /do\s+not\s+share\s+(your\s+)?(pin|otp|password)/i,
  /never\s+ask\s+for\s+(your\s+)?(pin|otp|password)/i,
  /we\s+never\s+ask\s+for/i,
  /অনুগ্রহ\s+করে\s+কারো\s+সাথে\s+আপনার\s+পিন\s+বা\s+ওটিপি/i,
  /পিন\s+বা\s+ওটিপি\s+শেয়ার\s+করবেন\s+না/i,
];

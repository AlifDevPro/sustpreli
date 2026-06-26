import { INVESTIGATION_CONSTANTS } from '../config/constants';
import { normalizeBanglaNumerals } from './amount-parser';

export interface ComplaintSignals {
  mentionedAmounts: number[];
  mentionedTransactionIds: string[];
  mentionedPhoneNumbers: string[];
  isPhishingReport: boolean;
  isRefundRequest: boolean;
  isWrongTransfer: boolean;
  isPaymentFailed: boolean;
  isDuplicatePayment: boolean;
  isCashInIssue: boolean;
  isSettlementDelay: boolean;
  isVague: boolean;
  mentionsNotReceived: boolean;
  mentionsBalanceDeducted: boolean;
  mentionsReverse: boolean;
}

const PHISHING_PATTERNS = [
  /\botp\b/i,
  /\bpin\b/i,
  /\bpassword\b/i,
  /asked\s+for\s+my/i,
  /share\s+(your|my)/i,
  /called\s+me/i,
  /someone\s+called/i,
  /scam/i,
  /phishing/i,
  /social\s+engineering/i,
  /account\s+will\s+be\s+blocked/i,
  /blocked\s+if/i,
  /claiming\s+to\s+be\s+from/i,
  /ফোন\s+করে/i,
  /ওটিপি/i,
  /পিন/i,
];

const REFUND_PATTERNS = [
  /\brefund\b/i,
  /money\s+back/i,
  /return\s+my\s+money/i,
  /get\s+my\s+money\s+back/i,
  /change\s+of\s+mind/i,
  /don't\s+want\s+it/i,
  /do\s+not\s+want\s+it/i,
  /ফেরত/i,
  /রিফান্ড/i,
];

const WRONG_TRANSFER_PATTERNS = [
  /wrong\s+transfer/i,
  /wrong\s+(number|person|recipient|account)/i,
  /sent\s+to\s+the\s+wrong/i,
  /to\s+a\s+wrong/i,
  /mistake/i,
  /mistyped/i,
  /typed\s+it\s+wrong/i,
  /ভুল\s+নম্বর/i,
  /ভুল\s+ব্যক্তি/i,
];

const PAYMENT_FAILED_PATTERNS = [
  /\bfailed\b/i,
  /showed\s+failed/i,
  /transaction\s+failed/i,
  /did\s+not\s+go\s+through/i,
  /ব্যর্থ/i,
];

const DUPLICATE_PATTERNS = [
  /\btwice\b/i,
  /\bdouble\b/i,
  /duplicate/i,
  /deducted\s+twice/i,
  /two\s+times/i,
  /only\s+paid\s+once/i,
  /দুই\s*বার/i,
  /দু'বার/i,
];

const CASH_IN_PATTERNS = [
  /cash[\s-]?in/i,
  /ক্যাশ\s*ইন/i,
  /agent.{0,20}cash/i,
  /balance.{0,30}not/i,
  /not\s+reflected/i,
  /টাকা\s+আসেনি/i,
  /ব্যালেন্স/i,
  /এজেন্ট/i,
];

const SETTLEMENT_PATTERNS = [
  /settlement/i,
  /settled/i,
  /not\s+been\s+settled/i,
  /sales.{0,20}not/i,
  /বিক্রয়/i,
];

const NOT_RECEIVED_PATTERNS = [
  /didn'?t\s+(get|receive)/i,
  /not\s+received/i,
  /hasn'?t\s+received/i,
  /didn'?t\s+get\s+it/i,
  /পায়নি/i,
  /পাইনি/i,
];

const BALANCE_DEDUCTED_PATTERNS = [
  /balance\s+(was\s+)?deducted/i,
  /deducted\s+from\s+my\s+(account|balance)/i,
  /money\s+was\s+taken/i,
  /ব্যালেন্স\s+কাটা/i,
];

const REVERSE_PATTERNS = [/\breverse\b/i, /reversal/i];

const TXN_ID_PATTERN = /\bTXN-[A-Z0-9][A-Z0-9-]*\b/gi;
const PHONE_PATTERN = /(?:\+?880)?0?1[3-9]\d{8}\b/g;

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function countMeaningfulWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2).length;
}

export function analyzeComplaint(complaint: string): ComplaintSignals {
  const text = normalizeBanglaNumerals(complaint);
  const mentionedTransactionIds = [...text.matchAll(TXN_ID_PATTERN)].map((match) =>
    match[0].toUpperCase(),
  );
  const mentionedPhoneNumbers = [...text.matchAll(PHONE_PATTERN)].map((match) => match[0]);

  const isPhishingReport = matchesAny(text, PHISHING_PATTERNS);
  const isRefundRequest = matchesAny(text, REFUND_PATTERNS);
  const isWrongTransfer = matchesAny(text, WRONG_TRANSFER_PATTERNS);
  const isPaymentFailed = matchesAny(text, PAYMENT_FAILED_PATTERNS);
  const isDuplicatePayment = matchesAny(text, DUPLICATE_PATTERNS);
  const isCashInIssue = matchesAny(text, CASH_IN_PATTERNS);
  const isSettlementDelay = matchesAny(text, SETTLEMENT_PATTERNS);
  const mentionsNotReceived = matchesAny(text, NOT_RECEIVED_PATTERNS);
  const mentionsBalanceDeducted = matchesAny(text, BALANCE_DEDUCTED_PATTERNS);
  const mentionsReverse = matchesAny(text, REVERSE_PATTERNS);

  const hasSpecifics =
    mentionedTransactionIds.length > 0 ||
    mentionedPhoneNumbers.length > 0 ||
    /\d{3,}/.test(text) ||
    isPhishingReport ||
    isWrongTransfer ||
    isPaymentFailed ||
    isDuplicatePayment ||
    isCashInIssue ||
    isSettlementDelay ||
    isRefundRequest;

  const isVague =
    !hasSpecifics &&
    countMeaningfulWords(text) <= INVESTIGATION_CONSTANTS.VAGUE_COMPLAINT_MAX_WORDS;

  return {
    mentionedAmounts: [], // filled by complaint analyzer orchestrator
    mentionedTransactionIds,
    mentionedPhoneNumbers,
    isPhishingReport,
    isRefundRequest,
    isWrongTransfer,
    isPaymentFailed,
    isDuplicatePayment,
    isCashInIssue,
    isSettlementDelay,
    isVague,
    mentionsNotReceived,
    mentionsBalanceDeducted,
    mentionsReverse,
  };
}

import {
  ALL_OUTPUT_FORBIDDEN_PATTERNS,
  SAFE_CREDENTIAL_PHRASES,
  SAFE_REFUND_PHRASE,
} from './forbidden-phrases';
import type { ProseFields, SafetyScanResult, SafetyViolation } from './types';

function extractSnippet(text: string, index: number): string {
  const start = Math.max(0, index - 25);
  const end = Math.min(text.length, index + 40);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function isSafeCredentialMention(text: string, matchIndex: number): boolean {
  const window = text.slice(Math.max(0, matchIndex - 60), matchIndex + 60);
  return SAFE_CREDENTIAL_PHRASES.some((pattern) => pattern.test(window));
}

function scanTextField(field: string, text: string): SafetyViolation[] {
  const violations: SafetyViolation[] = [];

  if (SAFE_REFUND_PHRASE.test(text)) {
    // Allow the official safe refund phrase; still scan for other violations
    for (const { id, pattern, category } of ALL_OUTPUT_FORBIDDEN_PATTERNS) {
      if (category === 'unauthorized_refund') {
        continue;
      }

      const match = pattern.exec(text);
      if (match) {
        if (category === 'credential_request' && isSafeCredentialMention(text, match.index)) {
          continue;
        }

        violations.push({
          field,
          category,
          matchedPattern: id,
          snippet: extractSnippet(text, match.index),
        });
      }
    }

    return violations;
  }

  for (const { id, pattern, category } of ALL_OUTPUT_FORBIDDEN_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) {
      continue;
    }

    if (category === 'credential_request' && isSafeCredentialMention(text, match.index)) {
      continue;
    }

    violations.push({
      field,
      category,
      matchedPattern: id,
      snippet: extractSnippet(text, match.index),
    });
  }

  return violations;
}

export function scanField(field: string, text: string): SafetyViolation[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  return scanTextField(field, text);
}

export function scanProseFields(prose: ProseFields): SafetyScanResult {
  const violations: SafetyViolation[] = [
    ...scanField('agent_summary', prose.agentSummary),
    ...scanField('recommended_next_action', prose.recommendedNextAction),
    ...scanField('customer_reply', prose.customerReply),
  ];

  return {
    passed: violations.length === 0,
    violations,
  };
}

export interface TicketResponseScanInput {
  ticketId: string;
  agentSummary: string;
  recommendedNextAction: string;
  customerReply: string;
  reasonCodes?: string[];
}

export function scanTicketResponse(response: TicketResponseScanInput): SafetyScanResult {
  const proseResult = scanProseFields({
    agentSummary: response.agentSummary,
    recommendedNextAction: response.recommendedNextAction,
    customerReply: response.customerReply,
  });

  const reasonViolations = (response.reasonCodes ?? []).flatMap((code, index) =>
    scanField(`reason_codes[${index}]`, code),
  );

  const violations = [...proseResult.violations, ...reasonViolations];

  return {
    passed: violations.length === 0,
    violations,
  };
}

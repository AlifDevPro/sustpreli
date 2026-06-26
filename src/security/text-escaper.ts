import {
  ALL_OUTPUT_FORBIDDEN_PATTERNS,
  SAFE_CREDENTIAL_PHRASES,
  SAFE_REFUND_PHRASE,
} from './forbidden-phrases';

/**
 * Escape HTML-like sequences to reduce injection in downstream renderers.
 */
export function escapeUnsafeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeCredentialContext(text: string, matchIndex: number): boolean {
  const windowStart = Math.max(0, matchIndex - 80);
  const windowEnd = Math.min(text.length, matchIndex + 80);
  const window = text.slice(windowStart, windowEnd);
  return SAFE_CREDENTIAL_PHRASES.some((pattern) => pattern.test(window));
}

function isSafeRefundContext(text: string): boolean {
  return SAFE_REFUND_PHRASE.test(text);
}

/**
 * Remove or neutralize unsafe phrases from untrusted (LLM) generated text.
 * Preserves vetted safe warning phrases.
 */
export function sanitizeUnsafeText(text: string): string {
  let result = stripControlCharacters(text);

  if (isSafeRefundContext(result)) {
    // Skip unauthorized refund pattern replacement when safe phrase present
    for (const { pattern, category } of ALL_OUTPUT_FORBIDDEN_PATTERNS) {
      if (category === 'unauthorized_refund') {
        continue;
      }
      if (category === 'credential_request') {
        result = replaceUnsafeCredentialPatterns(result, pattern);
      } else {
        result = result.replace(pattern, '[removed-unsafe-content]');
      }
    }
    return collapseRemovedMarkers(result);
  }

  for (const { pattern, category } of ALL_OUTPUT_FORBIDDEN_PATTERNS) {
    if (category === 'credential_request') {
      result = replaceUnsafeCredentialPatterns(result, pattern);
    } else {
      result = result.replace(pattern, '[removed-unsafe-content]');
    }
  }

  return collapseRemovedMarkers(result);
}

function replaceUnsafeCredentialPatterns(text: string, pattern: RegExp): string {
  let result = text;
  let match: RegExpExecArray | null;
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);

  while ((match = globalPattern.exec(text)) !== null) {
    if (isSafeCredentialContext(text, match.index)) {
      continue;
    }
    result = result.replace(match[0], '[removed-unsafe-content]');
  }

  return result;
}

export function stripControlCharacters(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function collapseRemovedMarkers(text: string): string {
  return text
    .replace(/(\[removed-unsafe-content\]\s*){2,}/g, '[removed-unsafe-content] ')
    .replace(/(\[redacted\]\s*){2,}/g, '[redacted] ')
    .trim();
}

export function containsUnsafePatterns(text: string): boolean {
  if (isSafeRefundContext(text)) {
    // Still check other patterns; refund phrase itself is safe
    for (const { pattern, category } of ALL_OUTPUT_FORBIDDEN_PATTERNS) {
      if (category === 'unauthorized_refund') {
        continue;
      }
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  return ALL_OUTPUT_FORBIDDEN_PATTERNS.some(({ pattern }) => pattern.test(text));
}

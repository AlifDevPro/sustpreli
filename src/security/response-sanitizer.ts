import { scanProseFields } from './output-safety.scanner';
import { buildSafeProse } from './safe-templates';
import { sanitizeUnsafeText, stripControlCharacters } from './text-escaper';
import type { DecisionBrief } from './safe-templates';
import type { ProseFields, SafetyScanResult } from './types';

export interface SanitizedProseResult {
  prose: ProseFields;
  scan: SafetyScanResult;
  usedFallback: boolean;
  sanitizedFields: string[];
}

function sanitizeProseFields(prose: ProseFields): { prose: ProseFields; sanitizedFields: string[] } {
  const sanitizedFields: string[] = [];
  const result: ProseFields = { ...prose };

  for (const key of ['agentSummary', 'recommendedNextAction', 'customerReply'] as const) {
    const original = prose[key];
    const cleaned = sanitizeUnsafeText(stripControlCharacters(original));
    if (cleaned !== original) {
      sanitizedFields.push(key);
    }
    result[key] = cleaned;
  }

  return { prose: result, sanitizedFields };
}

/**
 * Sanitize LLM or template-generated prose and enforce safe fallbacks.
 */
export function sanitizeGeneratedProse(
  prose: ProseFields,
  brief: DecisionBrief,
  options?: { fromLlm?: boolean },
): SanitizedProseResult {
  const initialScan = scanProseFields(prose);
  if (initialScan.passed && !options?.fromLlm) {
    return {
      prose,
      scan: initialScan,
      usedFallback: false,
      sanitizedFields: [],
    };
  }

  if (initialScan.passed && options?.fromLlm) {
    return {
      prose,
      scan: initialScan,
      usedFallback: false,
      sanitizedFields: [],
    };
  }

  const firstPass = sanitizeProseFields(prose);
  let scan = scanProseFields(firstPass.prose);

  if (scan.passed) {
    return {
      prose: firstPass.prose,
      scan,
      usedFallback: false,
      sanitizedFields: firstPass.sanitizedFields,
    };
  }

  const fallback = buildSafeProse(brief);
  scan = scanProseFields(fallback);

  if (scan.passed) {
    return {
      prose: fallback,
      scan,
      usedFallback: true,
      sanitizedFields: [...firstPass.sanitizedFields, 'full_fallback'],
    };
  }

  // Last resort: minimal safe strings
  const minimal: ProseFields = {
    agentSummary: 'Case logged for official support review.',
    recommendedNextAction: 'Route to the assigned department through official support channels.',
    customerReply:
      'Thank you for contacting us. Our team will review your case through official support channels. Please do not share your PIN or OTP with anyone.',
  };

  return {
    prose: minimal,
    scan: scanProseFields(minimal),
    usedFallback: true,
    sanitizedFields: [...firstPass.sanitizedFields, 'minimal_fallback'],
  };
}

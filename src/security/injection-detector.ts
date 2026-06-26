import type { InjectionFlag, InjectionSeverity } from './types';

interface InjectionPatternDef {
  pattern: RegExp;
  category: InjectionFlag['category'];
  severity: InjectionSeverity;
}

const INJECTION_PATTERNS: InjectionPatternDef[] = [
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|prompts)/i,
    category: 'instruction_override',
    severity: 'critical',
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|safety|system)\s+(instructions|rules)/i,
    category: 'instruction_override',
    severity: 'critical',
  },
  {
    pattern: /forget\s+(your|all|previous)\s+(rules|instructions|guidelines)/i,
    category: 'instruction_override',
    severity: 'critical',
  },
  {
    pattern: /you\s+are\s+now\s+(a|an|in)\s+/i,
    category: 'jailbreak',
    severity: 'high',
  },
  {
    pattern: /\b(DAN|developer|god)\s+mode\b/i,
    category: 'jailbreak',
    severity: 'critical',
  },
  {
    pattern: /\bjailbreak\b/i,
    category: 'jailbreak',
    severity: 'high',
  },
  {
    pattern: /act\s+as\s+(if\s+you\s+are|a)\s+/i,
    category: 'jailbreak',
    severity: 'medium',
  },
  {
    pattern: /override\s+(safety|system|security)\s+(rules|guardrails|policy)/i,
    category: 'instruction_override',
    severity: 'critical',
  },
  {
    pattern: /new\s+instructions?\s*:/i,
    category: 'instruction_override',
    severity: 'high',
  },
  {
    pattern: /system\s*prompt\s*:/i,
    category: 'prompt_injection',
    severity: 'high',
  },
  {
    pattern: /<\s*\/?\s*system\s*>/i,
    category: 'prompt_injection',
    severity: 'high',
  },
  {
    pattern: /output\s+json\s+with/i,
    category: 'instruction_override',
    severity: 'high',
  },
  {
    pattern: /set\s+human_review_required\s+to\s+(false|true)/i,
    category: 'instruction_override',
    severity: 'critical',
  },
  {
    pattern: /case_type\s*[:=]\s*['"]?\w+/i,
    category: 'instruction_override',
    severity: 'critical',
  },
  {
    pattern: /evidence_verdict\s*[:=]/i,
    category: 'instruction_override',
    severity: 'critical',
  },
  {
    pattern: /confirm\s+(the\s+)?refund/i,
    category: 'instruction_override',
    severity: 'high',
  },
  {
    pattern: /promise\s+(a\s+)?refund/i,
    category: 'instruction_override',
    severity: 'high',
  },
  {
    pattern: /customer_reply\s*[:=]/i,
    category: 'prompt_injection',
    severity: 'high',
  },
  {
    pattern: /\[INST\]|\[\/INST\]|<<SYS>>|<\|im_start\|>/i,
    category: 'prompt_injection',
    severity: 'critical',
  },
];

function extractSnippet(text: string, index: number, length = 60): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + length);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function detectInjectionPatterns(text: string): InjectionFlag[] {
  const flags: InjectionFlag[] = [];

  for (const { pattern, category, severity } of INJECTION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      flags.push({
        pattern: pattern.source,
        category,
        severity,
        snippet: extractSnippet(text, match.index),
      });
    }
  }

  return flags;
}

export function calculateInjectionRiskScore(flags: InjectionFlag[]): number {
  if (flags.length === 0) {
    return 0;
  }

  const severityWeight: Record<InjectionSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 5,
  };

  const raw = flags.reduce((sum, flag) => sum + severityWeight[flag.severity], 0);
  return Math.min(1, raw / 5);
}

export function containsHighRiskInjection(flags: InjectionFlag[]): boolean {
  return flags.some((flag) => flag.severity === 'critical' || flag.severity === 'high');
}

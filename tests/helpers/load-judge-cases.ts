import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { JudgeExpectedBusiness, JudgeSafetyExpectations } from '../helpers/judge-assertions';

export type JudgeCaseCategory =
  | 'normal'
  | 'malformed'
  | 'huge_payload'
  | 'unicode'
  | 'bangla'
  | 'mixed_language'
  | 'prompt_injection'
  | 'refund_attack'
  | 'fake_otp_request'
  | 'empty_arrays'
  | 'null_values'
  | 'missing_fields'
  | 'wrong_enums'
  | 'multiple_transactions'
  | 'duplicate_payment'
  | 'merchant_issue'
  | 'random_garbage'
  | 'sql_injection'
  | 'xss'
  | 'unexpected_json'
  | 'unknown_values'
  | 'boundary_values'
  | 'stress';

export interface JudgeHiddenCase {
  id: string;
  category: JudgeCaseCategory;
  label: string;
  rationale: string;
  expect_status: 200 | 400 | 413 | 422;
  input?: Record<string, unknown>;
  raw_body?: string;
  content_type?: string;
  expected?: JudgeExpectedBusiness;
  safety?: JudgeSafetyExpectations;
  /** HTTP-only cases (malformed JSON, oversized body) skip deterministic unit tests */
  http_only?: boolean;
}

export interface JudgeHiddenPack {
  _meta: {
    title: string;
    description: string;
    categories: JudgeCaseCategory[];
    scoring_notes: string[];
  };
  cases: JudgeHiddenCase[];
}

export function loadJudgeHiddenCases(): JudgeHiddenPack {
  const filePath = resolve(process.cwd(), 'tests/fixtures/judge-hidden-cases.json');
  return JSON.parse(readFileSync(filePath, 'utf-8')) as JudgeHiddenPack;
}

export function casesByCategory(category: JudgeCaseCategory): JudgeHiddenCase[] {
  return loadJudgeHiddenCases().cases.filter((c) => c.category === category);
}

export function unitTestableCases(): JudgeHiddenCase[] {
  return loadJudgeHiddenCases().cases.filter(
    (c) => c.expect_status === 200 && c.input !== undefined && !c.http_only,
  );
}

export function apiTestableCases(): JudgeHiddenCase[] {
  return loadJudgeHiddenCases().cases;
}

export function resolveJudgeCaseInput(
  testCase: JudgeHiddenCase,
  options: { hugeComplaintSize?: number } = {},
): Record<string, unknown> | undefined {
  if (!testCase.input) {
    return undefined;
  }

  const input = structuredClone(testCase.input) as Record<string, unknown>;

  if (input.complaint === '__HUGE_COMPLAINT_PLACEHOLDER__') {
    const size = options.hugeComplaintSize ?? 100_000;
    input.complaint = 'X'.repeat(size);
  }

  if (input.transaction_history === '__STRESS_TXNS_PLACEHOLDER__') {
    const history = Array.from({ length: 50 }, (_, index) => ({
      transaction_id: `TXN-${index}`,
      timestamp: `2026-04-14T${String(8 + Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00Z`,
      type: index % 2 === 0 ? 'payment' : 'transfer',
      amount: index === 49 ? 1234 : 100 + index,
      counterparty: `CP-${index}`,
      status: 'completed',
    }));
    input.transaction_history = history;
  }

  if (testCase.id === 'JUDGE-BND03' && typeof input.ticket_id === 'string') {
    input.ticket_id = `J-${'X'.repeat(126)}`;
  }

  return input;
}

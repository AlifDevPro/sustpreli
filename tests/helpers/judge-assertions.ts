import { expect } from 'vitest';

import {
  CASE_TYPES,
  DEPARTMENTS,
  EVIDENCE_VERDICTS,
  SEVERITIES,
} from '../../src/domain/enums/investigation.enums';
import { scanTicketResponse } from '../../src/security/output-safety.scanner';

export interface JudgeExpectedBusiness {
  relevant_transaction_id?: string | null;
  evidence_verdict?: string;
  case_type?: string;
  severity?: string;
  department?: string;
  human_review_required?: boolean;
}

export interface JudgeSafetyExpectations {
  must_contain?: string[];
  must_not_match?: string[];
}

export interface RawApiResponse {
  ticket_id?: string;
  relevant_transaction_id?: string | null;
  evidence_verdict?: string;
  case_type?: string;
  severity?: string;
  department?: string;
  agent_summary?: string;
  recommended_next_action?: string;
  customer_reply?: string;
  human_review_required?: boolean;
  confidence?: number;
  reason_codes?: string[];
  code?: string;
  error?: string;
  requestId?: string;
}

const REQUIRED_RESPONSE_FIELDS = [
  'ticket_id',
  'relevant_transaction_id',
  'evidence_verdict',
  'case_type',
  'severity',
  'department',
  'agent_summary',
  'recommended_next_action',
  'customer_reply',
  'human_review_required',
] as const;

export function assertResponseSchema(body: RawApiResponse): void {
  for (const field of REQUIRED_RESPONSE_FIELDS) {
    expect(body[field], `missing required field: ${field}`).toBeDefined();
  }

  expect(EVIDENCE_VERDICTS).toContain(body.evidence_verdict);
  expect(CASE_TYPES).toContain(body.case_type);
  expect(SEVERITIES).toContain(body.severity);
  expect(DEPARTMENTS).toContain(body.department);
  expect(typeof body.agent_summary).toBe('string');
  expect(typeof body.recommended_next_action).toBe('string');
  expect(typeof body.customer_reply).toBe('string');
  expect(body.agent_summary!.length).toBeGreaterThan(0);
  expect(body.recommended_next_action!.length).toBeGreaterThan(0);
  expect(body.customer_reply!.length).toBeGreaterThan(0);
  expect(typeof body.human_review_required).toBe('boolean');

  if (body.confidence !== undefined) {
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  }

  if (body.reason_codes !== undefined) {
    expect(Array.isArray(body.reason_codes)).toBe(true);
    expect(body.reason_codes!.length).toBeGreaterThan(0);
  }
}

export function assertBusinessExpectations(
  body: RawApiResponse,
  expected: JudgeExpectedBusiness,
  ticketId?: string,
): void {
  if (ticketId) {
    expect(body.ticket_id).toBe(ticketId);
  }

  if (expected.relevant_transaction_id !== undefined) {
    expect(body.relevant_transaction_id).toBe(expected.relevant_transaction_id);
  }

  if (expected.evidence_verdict !== undefined) {
    expect(body.evidence_verdict).toBe(expected.evidence_verdict);
  }

  if (expected.case_type !== undefined) {
    expect(body.case_type).toBe(expected.case_type);
  }

  if (expected.severity !== undefined) {
    expect(body.severity).toBe(expected.severity);
  }

  if (expected.department !== undefined) {
    expect(body.department).toBe(expected.department);
  }

  if (expected.human_review_required !== undefined) {
    expect(body.human_review_required).toBe(expected.human_review_required);
  }
}

export function assertSafetyExpectations(
  body: RawApiResponse,
  safety?: JudgeSafetyExpectations,
): void {
  const scan = scanTicketResponse({
    ticketId: body.ticket_id ?? 'unknown',
    agentSummary: body.agent_summary ?? '',
    recommendedNextAction: body.recommended_next_action ?? '',
    customerReply: body.customer_reply ?? '',
    reasonCodes: body.reason_codes,
  });

  expect(scan.passed, `safety scan failed: ${JSON.stringify(scan.violations)}`).toBe(true);

  const combined = [
    body.agent_summary ?? '',
    body.recommended_next_action ?? '',
    body.customer_reply ?? '',
  ].join('\n');

  for (const phrase of safety?.must_contain ?? []) {
    expect(combined.toLowerCase()).toContain(phrase.toLowerCase());
  }

  for (const pattern of safety?.must_not_match ?? []) {
    const unsafe = new RegExp(pattern, 'i');
    const safeNegation = /do\s+not\s+share|never\s+ask|never\s+request/i;
    const lines = combined.split('\n').filter((line) => !safeNegation.test(line));
    expect(lines.join('\n').toLowerCase()).not.toMatch(unsafe);
  }
}

export function assertErrorShape(
  body: RawApiResponse,
  expectedCode: string,
): void {
  expect(body.code).toBe(expectedCode);
  expect(typeof body.error).toBe('string');
  expect(body.error!.length).toBeGreaterThan(0);
}

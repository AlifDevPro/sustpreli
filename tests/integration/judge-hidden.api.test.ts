import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { VALIDATION_LIMITS } from '../../src/config/constants';
import { normalizeIdentifier } from '../../src/utils/text-normalizer';
import {
  assertBusinessExpectations,
  assertErrorShape,
  assertResponseSchema,
  assertSafetyExpectations,
} from '../helpers/judge-assertions';
import {
  apiTestableCases,
  casesByCategory,
  loadJudgeHiddenCases,
  resolveJudgeCaseInput,
} from '../helpers/load-judge-cases';
import { createJudgeTestApp } from '../helpers/test-app';

function sendJudgeCase(
  app: ReturnType<typeof createJudgeTestApp>,
  testCase: ReturnType<typeof apiTestableCases>[number],
  options: { hugeComplaintSize?: number } = {},
) {
  if (testCase.raw_body !== undefined) {
    return request(app)
      .post('/analyze-ticket')
      .set('Content-Type', testCase.content_type ?? 'application/json')
      .set('X-Request-Id', `judge-${testCase.id}`)
      .send(testCase.raw_body);
  }

  const input = resolveJudgeCaseInput(testCase, options);
  return request(app)
    .post('/analyze-ticket')
    .set('X-Request-Id', `judge-${testCase.id}`)
    .send(input);
}

describe('Judge hidden pack — HTTP integration', () => {
  const app = createJudgeTestApp({ jsonBodyLimit: '64kb' });
  const cases = apiTestableCases();

  afterAll(() => {
    // config reset handled per-suite in other files if needed
  });

  it('loads comprehensive hidden pack', () => {
    const pack = loadJudgeHiddenCases();
    expect(pack.cases.length).toBeGreaterThanOrEqual(50);
    expect(pack._meta.categories.length).toBeGreaterThanOrEqual(20);
  });

  it.each(cases.map((c) => [c.id, c] as const))(
    '%s — %s',
    async (id, testCase) => {
      const isHuge = testCase.id === 'JUDGE-H01';
      const response = await sendJudgeCase(app, testCase, {
        hugeComplaintSize: isHuge ? 100_000 : undefined,
      });

      expect(response.status).toBe(testCase.expect_status);

      if (testCase.expect_status === 200) {
        assertResponseSchema(response.body);
        const resolved = resolveJudgeCaseInput(testCase);
        const expectedTicketId =
          resolved && typeof resolved.ticket_id === 'string'
            ? normalizeIdentifier(resolved.ticket_id)
            : undefined;

        assertBusinessExpectations(
          response.body,
          testCase.expected ?? {},
          expectedTicketId,
        );
        assertSafetyExpectations(response.body, testCase.safety);
        expect(response.headers['x-request-id']).toBe(`judge-${testCase.id}`);
        return;
      }

      if (testCase.expect_status === 422) {
        assertErrorShape(response.body, 'SEMANTIC_VALIDATION_ERROR');
        return;
      }

      if (testCase.expect_status === 413) {
        expect(response.status).toBe(413);
        return;
      }

      if (testCase.raw_body !== undefined) {
        expect(['VALIDATION_ERROR', 'INVALID_JSON']).toContain(response.body.code);
        return;
      }

      assertErrorShape(response.body, 'VALIDATION_ERROR');
      expect(response.body.requestId).toBe(`judge-${testCase.id}`);
    },
  );
});

describe('Judge hidden pack — category spot checks', () => {
  const app = createJudgeTestApp();

  it('prompt injection cannot force case_type=other on duplicate payment', async () => {
    const testCase = casesByCategory('prompt_injection').find((c) => c.id === 'JUDGE-PI01')!;

    const response = await sendJudgeCase(app, testCase).expect(200);

    expect(response.body.case_type).toBe('duplicate_payment');
    expect(response.body.human_review_required).toBe(true);
  });

  it('refund attack output never promises refund', async () => {
    const testCase = casesByCategory('refund_attack')[0]!;

    const response = await sendJudgeCase(app, testCase).expect(200);

    assertSafetyExpectations(response.body, {
      must_not_match: ['we will refund', 'refund has been confirmed'],
    });
  });

  it('Bangla phishing routes to fraud_risk', async () => {
    const testCase = casesByCategory('bangla').find((c) => c.id === 'JUDGE-BN02')!;

    const response = await sendJudgeCase(app, testCase).expect(200);

    expect(response.body.department).toBe('fraud_risk');
    expect(response.body.severity).toBe('critical');
  });

  it('stress case completes within request budget', async () => {
    const testCase = casesByCategory('stress')[0]!;
    const started = Date.now();

    const response = await sendJudgeCase(app, testCase).expect(200);

    expect(Date.now() - started).toBeLessThan(5_000);
    expect(response.body.relevant_transaction_id).toBe('TXN-49');
  });

  it('boundary max complaint length accepted', async () => {
    const complaint = 'A'.repeat(VALIDATION_LIMITS.MAX_COMPLAINT_LENGTH);

    const response = await request(app)
      .post('/analyze-ticket')
      .send({ ticket_id: 'J-BND-COMPLAINT', complaint })
      .expect(200);

    expect(response.body.ticket_id).toBe('J-BND-COMPLAINT');
  });

  it('boundary complaint length + 1 rejected', async () => {
    const complaint = 'A'.repeat(VALIDATION_LIMITS.MAX_COMPLAINT_LENGTH + 1);

    const response = await request(app)
      .post('/analyze-ticket')
      .send({ ticket_id: 'J-BND-COMPLAINT+1', complaint });

    expect(response.status).toBe(400);
  });
});

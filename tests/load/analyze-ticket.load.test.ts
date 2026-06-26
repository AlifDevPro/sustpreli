import { performance } from 'node:perf_hooks';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { API_ROUTES } from '../../src/config/constants';
import { HACKATHON_LIMITS } from '../../src/config/performance';
import { assertResponseSchema } from '../helpers/judge-assertions';
import { loadJudgeHiddenCases, resolveJudgeCaseInput } from '../helpers/load-judge-cases';
import { createJudgeTestApp } from '../helpers/test-app';

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

describe('Judge load tests', () => {
  const app = createJudgeTestApp();
  const normalCases = loadJudgeHiddenCases().cases
    .filter((c) => c.category === 'normal' && c.expect_status === 200)
    .map((c) => resolveJudgeCaseInput(c)!);

  it(
    'health endpoint sustains concurrent requests',
    async () => {
      const concurrency = 50;
      const started = performance.now();

      const responses = await Promise.all(
        Array.from({ length: concurrency }, (_, index) =>
          request(app)
            .get('/health')
            .set('X-Request-Id', `load-health-${index}`),
        ),
      );

      const elapsed = performance.now() - started;

      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
      }

      expect(elapsed).toBeLessThan(HACKATHON_LIMITS.JUDGE_HEALTH_READY_MS);
      expect(elapsed / concurrency).toBeLessThan(500);
    },
    30_000,
  );

  it(
    'analyze-ticket sustains parallel valid requests',
    async () => {
      const concurrency = 30;
      const payloads = Array.from({ length: concurrency }, (_, index) => ({
        ...normalCases[index % normalCases.length],
        ticket_id: `LOAD-${index}`,
      }));

      const started = performance.now();
      const durations: number[] = [];

      const responses = await Promise.all(
        payloads.map(async (payload, index) => {
          const reqStart = performance.now();
          const response = await request(app)
            .post(API_ROUTES.ANALYZE_TICKET)
            .set('X-Request-Id', `load-analyze-${index}`)
            .send(payload);
          durations.push(performance.now() - reqStart);
          return response;
        }),
      );

      const elapsed = performance.now() - started;

      for (const response of responses) {
        expect(response.status).toBe(200);
        assertResponseSchema(response.body);
      }

      const p50 = percentile(durations, 50);
      const p95 = percentile(durations, 95);
      const max = Math.max(...durations);

      expect(p50).toBeLessThan(2_000);
      expect(p95).toBeLessThan(5_000);
      expect(max).toBeLessThan(HACKATHON_LIMITS.JUDGE_REQUEST_TIMEOUT_MS);
      expect(elapsed).toBeLessThan(HACKATHON_LIMITS.JUDGE_REQUEST_TIMEOUT_MS);
    },
    60_000,
  );

  it(
    'sequential burst of 100 analyze requests completes',
    async () => {
      const burstSize = 100;
      const durations: number[] = [];

      for (let index = 0; index < burstSize; index += 1) {
        const payload = {
          ...normalCases[index % normalCases.length],
          ticket_id: `BURST-${index}`,
        };

        const reqStart = performance.now();
        const response = await request(app)
          .post(API_ROUTES.ANALYZE_TICKET)
          .send(payload)
          .expect(200);

        durations.push(performance.now() - reqStart);
        expect(response.body.ticket_id).toBe(`BURST-${index}`);
      }

      const p99 = percentile(durations, 99);
      expect(p99).toBeLessThan(3_000);
    },
    120_000,
  );
});

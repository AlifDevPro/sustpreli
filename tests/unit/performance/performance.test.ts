import { describe, expect, it } from 'vitest';

import {
  calculateGroqTimeoutMs,
  HACKATHON_LIMITS,
  PERFORMANCE_BUDGETS,
} from '../../../src/config/performance';
import {
  createPerformanceContext,
  mark,
  remainingMs,
  summarize,
} from '../../../src/utils/performance-profiler';

describe('performance budgets', () => {
  it('keeps request timeout under judge limit', () => {
    expect(PERFORMANCE_BUDGETS.REQUEST_TIMEOUT_DEFAULT_MS).toBeLessThan(
      HACKATHON_LIMITS.JUDGE_REQUEST_TIMEOUT_MS,
    );
  });

  it('calculates groq timeout from remaining deadline', () => {
    expect(calculateGroqTimeoutMs(20_000, 12_000)).toBe(12_000);
    expect(calculateGroqTimeoutMs(5_000, 12_000)).toBe(4_200);
    expect(calculateGroqTimeoutMs(3_000, 12_000)).toBe(0);
  });

  it('tracks stage marks and summary', () => {
    const context = createPerformanceContext('req-1', 28_000);
    const start = Date.now();
    mark(context, 'validation', start);
    const summary = summarize(context);

    expect(summary.requestId).toBe('req-1');
    expect(summary.validationMs).toBeGreaterThanOrEqual(0);
    expect(remainingMs(context)).toBeLessThanOrEqual(28_000);
  });
});

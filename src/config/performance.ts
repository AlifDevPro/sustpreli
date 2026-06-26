/**
 * Hackathon-enforced limits (judge harness).
 * REQUEST: 30_000ms hard limit
 * HEALTH:   60_000ms readiness after process start
 */
export const HACKATHON_LIMITS = {
  JUDGE_REQUEST_TIMEOUT_MS: 30_000,
  JUDGE_HEALTH_READY_MS: 60_000,
} as const;

/** Internal budgets — leave buffer under judge limits */
export const PERFORMANCE_BUDGETS = {
  /** Express middleware timeout (default 28s — 2s under judge limit) */
  REQUEST_TIMEOUT_DEFAULT_MS: 28_000,
  /** Reserved for validation + investigation + security + response assembly */
  DETERMINISTIC_PIPELINE_RESERVE_MS: 500,
  /** Minimum time allocated to Groq even when deadline is tight */
  GROQ_MIN_TIMEOUT_MS: 3_000,
  /** Default Groq prose timeout cap */
  GROQ_PROSE_DEFAULT_MS: 12_000,
  /** Buffer before request deadline when scheduling Groq */
  REQUEST_DEADLINE_BUFFER_MS: 800,
  /** Log requests slower than this threshold */
  SLOW_REQUEST_THRESHOLD_MS: 5_000,
  /** Expected latency targets for benchmarking (p50 guidance) */
  TARGET_P50_NO_LLM_MS: 80,
  TARGET_P50_WITH_LLM_MS: 2_500,
  TARGET_P99_WITH_LLM_MS: 8_000,
} as const;

export function calculateGroqTimeoutMs(
  remainingMs: number,
  configuredMaxMs: number,
): number {
  const capped = Math.min(
    configuredMaxMs,
    remainingMs - PERFORMANCE_BUDGETS.REQUEST_DEADLINE_BUFFER_MS,
  );

  if (capped < PERFORMANCE_BUDGETS.GROQ_MIN_TIMEOUT_MS) {
    return 0;
  }

  return Math.floor(capped);
}

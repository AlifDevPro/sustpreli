export interface PerformanceMark {
  name: string;
  durationMs: number;
  atMs: number;
}

export interface PerformanceContext {
  requestId: string;
  startedAt: number;
  deadlineAt: number;
  marks: PerformanceMark[];
}

export function createPerformanceContext(
  requestId: string,
  timeoutMs: number,
): PerformanceContext {
  const startedAt = Date.now();
  return {
    requestId,
    startedAt,
    deadlineAt: startedAt + timeoutMs,
    marks: [],
  };
}

export function remainingMs(context: PerformanceContext): number {
  return Math.max(0, context.deadlineAt - Date.now());
}

export function mark(context: PerformanceContext, name: string, startTime: number): void {
  context.marks.push({
    name,
    durationMs: Date.now() - startTime,
    atMs: Date.now() - context.startedAt,
  });
}

export function summarize(context: PerformanceContext): Record<string, number | string> {
  const totalMs = Date.now() - context.startedAt;
  const summary: Record<string, number | string> = {
    requestId: context.requestId,
    totalMs,
    remainingMs: remainingMs(context),
  };

  for (const entry of context.marks) {
    summary[`${entry.name}Ms`] = entry.durationMs;
  }

  return summary;
}

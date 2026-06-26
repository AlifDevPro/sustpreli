/**
 * Local latency benchmark for deterministic pipeline (no live Groq).
 * Run: npm run benchmark
 */
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';

import { PERFORMANCE_BUDGETS } from '../src/config/performance';
import { AnalyzeTicketPipeline } from '../src/pipelines/analyze-ticket.pipeline';
import { createPerformanceContext } from '../src/utils/performance-profiler';
import { requestValidator } from '../src/validation/request.validator';

interface SampleCase {
  id: string;
  input: Record<string, unknown>;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

async function main(): Promise<void> {
  const samplePath = resolve(process.cwd(), 'SUST_Preli_Sample_Cases.json');
  const payload = JSON.parse(readFileSync(samplePath, 'utf8')) as { cases: SampleCase[] };
  const samples = payload.cases;
  const pipeline = new AnalyzeTicketPipeline();
  const iterations = 50;
  const durations: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    for (const sample of samples) {
      const ticket = requestValidator.validateAndMap(sample.input);
      const perf = createPerformanceContext(`bench-${i}`, 28_000);
      const start = performance.now();

      await pipeline.execute(ticket, { performance: perf, requestId: perf.requestId });

      durations.push(performance.now() - start);
    }
  }

  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const max = Math.max(...durations);

  console.log('QueueStorm Investigator — deterministic pipeline benchmark');
  console.log(`Samples: ${samples.length} cases x ${iterations} iterations = ${durations.length} runs`);
  console.log(`Target p50 (no LLM): <= ${PERFORMANCE_BUDGETS.TARGET_P50_NO_LLM_MS}ms`);
  console.log(`p50: ${p50.toFixed(2)}ms`);
  console.log(`p95: ${p95.toFixed(2)}ms`);
  console.log(`p99: ${p99.toFixed(2)}ms`);
  console.log(`max: ${max.toFixed(2)}ms`);

  if (p50 > PERFORMANCE_BUDGETS.TARGET_P50_NO_LLM_MS) {
    console.warn('WARN: p50 exceeds target — review investigation/validation hot paths');
    process.exitCode = 1;
  }
}

void main();

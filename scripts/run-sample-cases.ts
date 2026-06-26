/**
 * Run public sample cases against a live API.
 * Usage: API_URL=http://localhost:3000 npm run sample:run
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface SampleCase {
  id: string;
  input: Record<string, unknown>;
  expected_output: Record<string, unknown>;
}

const apiUrl = process.env.API_URL ?? 'http://localhost:3000';

async function main(): Promise<void> {
  const samplePath = resolve(process.cwd(), 'SUST_Preli_Sample_Cases.json');
  const payload = JSON.parse(readFileSync(samplePath, 'utf8')) as { cases: SampleCase[] };

  let passed = 0;
  let failed = 0;

  for (const sample of payload.cases) {
    const response = await fetch(`${apiUrl}/analyze-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': `live-${sample.id}` },
      body: JSON.stringify(sample.input),
    });

    if (!response.ok) {
      console.error(`FAIL ${sample.id}: HTTP ${response.status}`);
      failed += 1;
      continue;
    }

    const body = (await response.json()) as Record<string, unknown>;
    const expected = sample.expected_output;
    const checks: Array<[string, unknown, unknown]> = [
      ['relevant_transaction_id', body.relevant_transaction_id, expected.relevant_transaction_id],
      ['evidence_verdict', body.evidence_verdict, expected.evidence_verdict],
      ['case_type', body.case_type, expected.case_type],
      ['department', body.department, expected.department],
      ['human_review_required', body.human_review_required, expected.human_review_required],
    ];

    const mismatches = checks.filter(([, actual, exp]) => actual !== exp);
    if (mismatches.length > 0) {
      failed += 1;
      console.error(`FAIL ${sample.id}:`);
      for (const [field, actual, exp] of mismatches) {
        console.error(`  ${field}: got ${JSON.stringify(actual)} expected ${JSON.stringify(exp)}`);
      }
      continue;
    }

    passed += 1;
    console.log(`PASS ${sample.id}`);
  }

  console.log(`\n${passed}/${payload.cases.length} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();

/**
 * Generate JSON outputs for all public sample cases (offline, no HTTP server).
 * Usage: npm run sample:generate
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AiPipeline } from '../src/ai/ai.pipeline';
import { loadConfig } from '../src/config';
import { AnalyzeTicketPipeline } from '../src/pipelines/analyze-ticket.pipeline';
import { createLogger } from '../src/utils/logger';
import { requestValidator } from '../src/validation/request.validator';

interface SampleCase {
  id: string;
  input: Record<string, unknown>;
}

async function main(): Promise<void> {
  const samplePath = resolve(process.cwd(), 'SUST_Preli_Sample_Cases.json');
  const payload = JSON.parse(readFileSync(samplePath, 'utf8')) as { cases: SampleCase[] };
  const outDir = resolve(process.cwd(), 'outputs');
  mkdirSync(outDir, { recursive: true });

  const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', GROQ_API_KEY: '' });
  const pipeline = new AnalyzeTicketPipeline(new AiPipeline(config, createLogger(config)));

  for (const sample of payload.cases) {
    const ticket = requestValidator.validateAndMap(sample.input);
    const result = await pipeline.execute(ticket, { requestId: `sample-${sample.id}` });
    const ticketId = String(sample.input.ticket_id ?? sample.id);
    const outPath = resolve(outDir, `sample-output-${ticketId}.json`);
    writeFileSync(outPath, `${JSON.stringify(result.raw, null, 2)}\n`, 'utf8');
    console.log(`wrote ${outPath}`);
  }
}

void main();

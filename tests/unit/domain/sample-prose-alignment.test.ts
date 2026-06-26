import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ClassificationEngine } from '../../../src/domain/classification/classification.engine';
import { generateDeterministicProse } from '../../../src/security/response-text.generator';
import { RequestValidator } from '../../../src/validation/request.validator';

const validator = new RequestValidator();
const engine = new ClassificationEngine();

interface SampleCase {
  id: string;
  input: Record<string, unknown>;
  expected_output: {
    agent_summary: string;
    recommended_next_action: string;
    customer_reply: string;
  };
}

const samplePath = resolve(process.cwd(), 'SUST_Preli_Sample_Cases.json');
const { cases } = JSON.parse(readFileSync(samplePath, 'utf8')) as { cases: SampleCase[] };

describe('public sample prose alignment', () => {
  it.each(cases)('$id agent_summary includes key transaction details', ({ input, expected_output }) => {
    const request = validator.validateAndMap(input);
    const decision = engine.analyze(request);
    const prose = generateDeterministicProse(request, decision);

    expect(prose.agentSummary).toBe(expected_output.agent_summary);
  });

  it.each(cases)('$id recommended_next_action matches expected', ({ input, expected_output }) => {
    const request = validator.validateAndMap(input);
    const decision = engine.analyze(request);
    const prose = generateDeterministicProse(request, decision);

    expect(prose.recommendedNextAction).toBe(expected_output.recommended_next_action);
  });

  it.each(cases)('$id customer_reply matches expected', ({ input, expected_output }) => {
    const request = validator.validateAndMap(input);
    const decision = engine.analyze(request);
    const prose = generateDeterministicProse(request, decision);

    expect(prose.customerReply).toBe(expected_output.customer_reply);
  });
});

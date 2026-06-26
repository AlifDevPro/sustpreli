import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { loadConfig, resetConfigForTests } from '../../src/config';
import { VALIDATION_LIMITS } from '../../src/config/constants';
import { buildDependencies } from '../../src/container';
import { createLogger } from '../../src/utils/logger';

function createTestApp() {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_ENABLED: 'false',
    JSON_BODY_LIMIT: '64kb',
  });
  const logger = createLogger(config);
  const deps = buildDependencies(config, logger);
  return createApp(deps);
}

function loadSampleInputs(): Record<string, unknown>[] {
  const filePath = resolve(process.cwd(), 'SUST_Preli_Sample_Cases.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as {
    cases: Array<{ input: Record<string, unknown> }>;
  };
  return raw.cases.map((sampleCase) => sampleCase.input);
}

describe('POST /analyze-ticket validation (integration)', () => {
  const app = createTestApp();

  afterAll(() => {
    resetConfigForTests();
  });

  describe('valid payloads pass validation', () => {
    it('returns 200 with decision for minimal valid body', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({ ticket_id: 'TKT-001', complaint: 'Valid complaint text' })
        .expect(200);

      expect(response.body.ticket_id).toBe('TKT-001');
      expect(response.body.case_type).toBeDefined();
      expect(response.body.evidence_verdict).toBeDefined();
    });

    it('returns 200 for all 10 public sample inputs', async () => {
      const inputs = loadSampleInputs();

      for (const input of inputs) {
        const response = await request(app).post('/analyze-ticket').send(input);

        expect(response.status).toBe(200);
        expect(response.body.ticket_id).toBe(input.ticket_id);
        expect(response.body.case_type).toBeDefined();
      }
    });
  });

  describe('400 Bad Request', () => {
    it('rejects invalid JSON', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .set('Content-Type', 'application/json')
        .send('{ not valid json')
        .expect(400);

      expect(response.body.code).toBe('INVALID_JSON');
    });

    it('rejects array body', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send([{ ticket_id: 'TKT-001', complaint: 'x' }])
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing ticket_id', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({ complaint: 'hello' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.error).toMatch(/ticket_id/i);
    });

    it('rejects missing complaint', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({ ticket_id: 'TKT-001' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.error).toMatch(/complaint/i);
    });

    it('rejects invalid language', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({ ticket_id: 'TKT-001', complaint: 'hello', language: 'fr' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.error).toMatch(/language/i);
    });

    it('rejects invalid transaction type', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({
          ticket_id: 'TKT-001',
          complaint: 'hello',
          transaction_history: [
            {
              transaction_id: 'TXN-1',
              timestamp: '2026-04-14T14:08:22Z',
              type: 'invalid_type',
              amount: 100,
              counterparty: 'x',
              status: 'completed',
            },
          ],
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid amount', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({
          ticket_id: 'TKT-001',
          complaint: 'hello',
          transaction_history: [
            {
              transaction_id: 'TXN-1',
              timestamp: '2026-04-14T14:08:22Z',
              type: 'transfer',
              amount: -50,
              counterparty: 'x',
              status: 'completed',
            },
          ],
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.error).toMatch(/amount/i);
    });

    it('rejects invalid timestamp', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({
          ticket_id: 'TKT-001',
          complaint: 'hello',
          transaction_history: [
            {
              transaction_id: 'TXN-1',
              timestamp: 'yesterday',
              type: 'transfer',
              amount: 50,
              counterparty: 'x',
              status: 'completed',
            },
          ],
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.error).toMatch(/timestamp/i);
    });

    it('rejects prototype pollution payload', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .set('Content-Type', 'application/json')
        .send('{"ticket_id":"TKT-001","complaint":"x","__proto__":{"admin":true}}')
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.error).toMatch(/forbidden key/i);
    });

    it('includes requestId in error response', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .set('X-Request-Id', 'validation-test-id')
        .send({ complaint: 'no ticket id' })
        .expect(400);

      expect(response.body.requestId).toBe('validation-test-id');
    });
  });

  describe('422 Unprocessable Entity', () => {
    it('rejects empty complaint', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({ ticket_id: 'TKT-001', complaint: '' })
        .expect(422);

      expect(response.body.code).toBe('SEMANTIC_VALIDATION_ERROR');
      expect(response.body.error).toMatch(/complaint cannot be empty/i);
    });

    it('rejects whitespace-only complaint', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({ ticket_id: 'TKT-001', complaint: '   \t\n  ' })
        .expect(422);

      expect(response.body.code).toBe('SEMANTIC_VALIDATION_ERROR');
    });
  });

  describe('oversized payloads', () => {
    it('rejects body exceeding JSON limit', async () => {
      const hugeComplaint = 'x'.repeat(100_000);

      const response = await request(app)
        .post('/analyze-ticket')
        .send({ ticket_id: 'TKT-001', complaint: hugeComplaint });

      expect(response.status).toBe(413);
    });
  });

  describe('normalization via HTTP', () => {
    it('accepts unicode and whitespace in complaint', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({
          ticket_id: '  TKT-010  ',
          complaint: '  hello   world  ',
        })
        .expect(200);

      expect(response.body.ticket_id).toBe('TKT-010');
    });
  });
});

describe('validation limits configuration', () => {
  it('documents complaint limit for harness alignment', () => {
    expect(VALIDATION_LIMITS.MAX_COMPLAINT_LENGTH).toBeGreaterThan(0);
  });
});

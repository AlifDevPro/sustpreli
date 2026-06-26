import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { loadConfig, resetConfigForTests } from '../../src/config';
import { buildDependencies } from '../../src/container';
import { createLogger } from '../../src/utils/logger';

describe('HTTP API', () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_ENABLED: 'false',
  });
  const logger = createLogger(config);
  const deps = buildDependencies(config, logger);
  const app = createApp(deps);

  afterAll(() => {
    resetConfigForTests();
  });

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });

    it('includes X-Request-Id header', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('honors incoming X-Request-Id header', async () => {
      const requestId = 'test-request-id-123';

      const response = await request(app)
        .get('/health')
        .set('X-Request-Id', requestId)
        .expect(200);

      expect(response.headers['x-request-id']).toBe(requestId);
    });
  });

  describe('POST /analyze-ticket', () => {
    it('returns full safe response for valid request', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .send({ ticket_id: 'TKT-001', complaint: 'Something is wrong with my money. Please check.' })
        .expect(200);

      expect(response.body.ticket_id).toBe('TKT-001');
      expect(response.body.case_type).toBe('other');
      expect(response.body.evidence_verdict).toBe('insufficient_data');
      expect(response.body.customer_reply).toBeDefined();
      expect(response.body.agent_summary).toBeDefined();
      expect(response.body.recommended_next_action).toBeDefined();
      expect(response.body.customer_reply.toLowerCase()).toContain('do not share');
    });
  });

  describe('error handling', () => {
    it('returns 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown').expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid JSON', async () => {
      const response = await request(app)
        .post('/analyze-ticket')
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);

      expect(response.body.code).toBe('INVALID_JSON');
    });
  });
});

describe('environment validation', () => {
  afterAll(() => {
    resetConfigForTests();
  });

  it('rejects invalid PORT values', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        PORT: '-1',
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('requires GROQ_API_KEY in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        GROQ_API_KEY: '',
      }),
    ).toThrow(/GROQ_API_KEY is required/);
  });
});

import { describe, expect, it } from 'vitest';

import { parseEnv } from '../../../src/config/env.schema';

describe('envSchema GROQ_BASE_URL', () => {
  it('defaults to the Groq API host without /openai/v1 suffix', () => {
    const env = parseEnv({ NODE_ENV: 'test' });
    expect(env.GROQ_BASE_URL).toBe('https://api.groq.com');
  });

  it('strips a trailing /openai/v1 from misconfigured values', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
    });
    expect(env.GROQ_BASE_URL).toBe('https://api.groq.com');
  });
});

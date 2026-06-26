import { createApp } from '../../src/app';
import { loadConfig } from '../../src/config';
import { buildDependencies } from '../../src/container';
import { createLogger } from '../../src/utils/logger';

export function createJudgeTestApp(options: {
  jsonBodyLimit?: string;
  rateLimitEnabled?: boolean;
} = {}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_ENABLED: options.rateLimitEnabled === true ? 'true' : 'false',
    GROQ_API_KEY: '',
    JSON_BODY_LIMIT: options.jsonBodyLimit ?? '1mb',
  });

  return createApp(buildDependencies(config, createLogger(config)));
}

import dotenv from 'dotenv';

import { type Env, parseEnv } from './env.schema';

let cachedConfig: Env | null = null;

export function loadConfig(overrides?: NodeJS.ProcessEnv): Env {
  if (overrides) {
    return parseEnv({ ...process.env, ...overrides });
  }

  if (cachedConfig) {
    return cachedConfig;
  }

  if (process.env.NODE_ENV !== 'test') {
    dotenv.config();
  }

  cachedConfig = parseEnv(process.env);
  return cachedConfig;
}

export function getConfig(): Env {
  if (!cachedConfig) {
    throw new Error('Configuration has not been loaded. Call loadConfig() first.');
  }

  return cachedConfig;
}

export function resetConfigForTests(): void {
  cachedConfig = null;
}

export type { Env };

import pino, { type Logger } from 'pino';

import { type Env } from '../config';

export function createLogger(config: Env): Logger {
  const isDevelopment = config.NODE_ENV === 'development';

  return pino({
    level: config.LOG_LEVEL,
    base: {
      pid: process.pid,
      env: config.NODE_ENV,
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'GROQ_API_KEY',
        'groqApiKey',
        'apiKey',
      ],
      censor: '[REDACTED]',
    },
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
}

export function createChildLogger(logger: Logger, bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

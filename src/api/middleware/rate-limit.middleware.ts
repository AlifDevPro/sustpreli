import rateLimit from 'express-rate-limit';

import { type Env } from '../../config';

export function createRateLimitMiddleware(config: Env) {
  if (!config.RATE_LIMIT_ENABLED) {
    return (_req: unknown, _res: unknown, next: () => void) => next();
  }

  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    skip: (req) => req.path === '/health',
  });
}

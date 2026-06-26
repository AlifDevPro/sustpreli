import { type NextFunction, type Request, type Response } from 'express';

import { type Env } from '../../config';
import { RequestTimeoutError } from '../../errors/app-error';

export function createTimeoutMiddleware(config: Env) {
  const timeoutMs = config.REQUEST_TIMEOUT_MS;

  return (req: Request, res: Response, next: NextFunction): void => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled || res.headersSent) {
        return;
      }

      settled = true;
      req.abortController?.abort();
      next(new RequestTimeoutError());
    }, timeoutMs);

    const clearTimer = (): void => {
      settled = true;
      clearTimeout(timer);
    };

    res.on('finish', clearTimer);
    res.on('close', clearTimer);

    next();
  };
}

import { type NextFunction, type Request, type Response } from 'express';

import { type Env } from '../../config';
import { createPerformanceContext } from '../../utils/performance-profiler';

export function createPerformanceMiddleware(config: Env) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const abortController = new AbortController();
    req.abortController = abortController;
    req.performance = createPerformanceContext(req.requestId, config.REQUEST_TIMEOUT_MS);
    next();
  };
}

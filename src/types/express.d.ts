import 'express-async-errors';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: import('pino').Logger;
      performance?: import('../utils/performance-profiler').PerformanceContext;
      abortController?: AbortController;
    }
  }
}

export {};

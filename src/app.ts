import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { registerRoutes } from './api/routes';
import { createErrorHandlerMiddleware } from './api/middleware/error-handler.middleware';
import { createPerformanceMiddleware } from './api/middleware/performance.middleware';
import { notFoundMiddleware } from './api/middleware/not-found.middleware';
import { createRateLimitMiddleware } from './api/middleware/rate-limit.middleware';
import { requestIdMiddleware } from './api/middleware/request-id.middleware';
import { createTimeoutMiddleware } from './api/middleware/timeout.middleware';
import { type AppDependencies } from './container';

export function createApp(deps: AppDependencies): Express {
  const { config, logger } = deps;
  const app = express();

  if (config.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');

  app.use(helmet());
  app.use(requestIdMiddleware);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.requestId,
      customProps: (req) => ({
        requestId: req.requestId,
      }),
      customLogLevel: (_req, res, err) => {
        if (res.statusCode === 501) {
          return 'warn';
        }

        if (err || res.statusCode >= 500) {
          return 'error';
        }

        if (res.statusCode >= 400) {
          return 'warn';
        }

        return 'info';
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    }),
  );

  if (config.CORS_ENABLED) {
    app.use(
      cors({
        origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-Request-Id'],
        exposedHeaders: ['X-Request-Id'],
      }),
    );
  }

  if (config.COMPRESSION_ENABLED) {
    app.use(
      compression({
        filter: (req, res) => {
          if (req.path === '/health') {
            return false;
          }

          return compression.filter(req, res);
        },
      }),
    );
  }

  app.use(createRateLimitMiddleware(config));

  app.use(
    express.json({
      limit: config.JSON_BODY_LIMIT,
      strict: true,
    }),
  );

  const timeoutMiddleware = createTimeoutMiddleware(config);
  const performanceMiddleware = createPerformanceMiddleware(config);

  registerRoutes(
    app,
    {
      healthController: deps.healthController,
      analyzeTicketController: deps.analyzeTicketController,
    },
    timeoutMiddleware,
    performanceMiddleware,
  );

  app.use(notFoundMiddleware);
  app.use(createErrorHandlerMiddleware(logger));

  return app;
}

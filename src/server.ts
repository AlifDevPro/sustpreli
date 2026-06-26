import { type Server } from 'node:http';

import { type Express } from 'express';
import { type Logger } from 'pino';

import { type Env } from './config';
import { destroyHttpAgents } from './utils/http-agents';

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

export interface HttpServer {
  server: Server;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createHttpServer(app: Express, config: Env, logger: Logger): HttpServer {
  let server: Server | null = null;
  let isShuttingDown = false;

  const start = (): Promise<void> =>
    new Promise((resolve, reject) => {
      server = app.listen(config.PORT, config.HOST, () => {
        server!.keepAliveTimeout = config.HTTP_KEEP_ALIVE_TIMEOUT_MS;
        server!.headersTimeout = config.HTTP_HEADERS_TIMEOUT_MS;
        server!.requestTimeout = config.REQUEST_TIMEOUT_MS + 2_000;

        logger.info(
          {
            host: config.HOST,
            port: config.PORT,
            nodeEnv: config.NODE_ENV,
            keepAliveTimeoutMs: config.HTTP_KEEP_ALIVE_TIMEOUT_MS,
            headersTimeoutMs: config.HTTP_HEADERS_TIMEOUT_MS,
            requestTimeoutMs: config.REQUEST_TIMEOUT_MS,
          },
          'server started',
        );
        resolve();
      });

      server.on('error', (error) => {
        logger.error({ err: error }, 'server failed to start');
        reject(error);
      });
    });

  const stop = (): Promise<void> => {
    if (!server) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      server!.close((error) => {
        destroyHttpAgents();

        if (error) {
          reject(error);
          return;
        }

        logger.info('server stopped');
        resolve();
      });
    });
  };

  const handleShutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, 'graceful shutdown initiated');

    const forceExitTimer = setTimeout(() => {
      logger.error('graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);

    stop()
      .then(() => {
        clearTimeout(forceExitTimer);
        process.exit(0);
      })
      .catch((error: unknown) => {
        clearTimeout(forceExitTimer);
        logger.error({ err: error }, 'error during graceful shutdown');
        process.exit(1);
      });
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, () => handleShutdown(signal));
  }

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled promise rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception');
    void stop().finally(() => process.exit(1));
  });

  return {
    get server() {
      if (!server) {
        throw new Error('Server has not been started');
      }

      return server;
    },
    start,
    stop,
  };
}

import { createApp } from './app';
import { loadConfig } from './config';
import { buildDependencies } from './container';
import { createHttpServer } from './server';
import { createLogger } from './utils/logger';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const dependencies = buildDependencies(config, logger);
  const app = createApp(dependencies);
  const httpServer = createHttpServer(app, config, logger);

  await httpServer.start();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  console.error(`Failed to start application: ${message}`);
  process.exit(1);
});

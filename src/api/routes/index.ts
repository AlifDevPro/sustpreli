import { type Express } from 'express';

import { type AnalyzeTicketController } from '../controllers/analyze-ticket.controller';
import { type HealthController } from '../controllers/health.controller';
import { type RequestHandler } from 'express';
import { createAnalyzeTicketRouter } from './analyze-ticket.routes';
import { createHealthRouter } from './health.routes';

export interface RouteControllers {
  healthController: HealthController;
  analyzeTicketController: AnalyzeTicketController;
}

export function registerRoutes(
  app: Express,
  controllers: RouteControllers,
  timeoutMiddleware: RequestHandler,
  performanceMiddleware: RequestHandler,
): void {
  app.use(createHealthRouter(controllers.healthController));
  app.use(
    createAnalyzeTicketRouter(
      controllers.analyzeTicketController,
      timeoutMiddleware,
      performanceMiddleware,
    ),
  );
}

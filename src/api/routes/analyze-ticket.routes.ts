import { Router, type RequestHandler } from 'express';

import { API_ROUTES } from '../../config/constants';
import { type AnalyzeTicketController } from '../controllers/analyze-ticket.controller';
import { asyncHandler } from '../middleware/async-handler.middleware';

export function createAnalyzeTicketRouter(
  analyzeTicketController: AnalyzeTicketController,
  timeoutMiddleware: RequestHandler,
  performanceMiddleware: RequestHandler,
): Router {
  const router = Router();

  router.post(
    API_ROUTES.ANALYZE_TICKET,
    performanceMiddleware,
    timeoutMiddleware,
    asyncHandler(analyzeTicketController.analyze),
  );

  return router;
}

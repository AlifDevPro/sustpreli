import { Router } from 'express';

import { API_ROUTES } from '../../config/constants';
import { type HealthController } from '../controllers/health.controller';
import { asyncHandler } from '../middleware/async-handler.middleware';

export function createHealthRouter(healthController: HealthController): Router {
  const router = Router();

  router.get(API_ROUTES.HEALTH, asyncHandler(healthController.check));

  return router;
}

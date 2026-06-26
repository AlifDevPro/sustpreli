import { type Request, type Response } from 'express';

import { type HealthService } from '../../services/health.service';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  check = async (_req: Request, res: Response): Promise<void> => {
    const result = this.healthService.check();
    res.status(200).json(result);
  };
}

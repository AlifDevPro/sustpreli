import { type NextFunction, type Request, type Response } from 'express';

import { NotFoundError } from '../../errors/app-error';

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

import { type NextFunction, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header(REQUEST_ID_HEADER);
  const requestId =
    typeof incomingId === 'string' && incomingId.trim().length > 0
      ? incomingId.trim()
      : uuidv4();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

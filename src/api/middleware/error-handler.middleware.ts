import { type NextFunction, type Request, type Response } from 'express';
import { type Logger } from 'pino';

import { AppError, type ErrorResponseBody, InternalError } from '../../errors/app-error';
import { ERROR_CODES } from '../../errors/error-codes';

function isSyntaxError(error: unknown): error is SyntaxError {
  return error instanceof SyntaxError;
}

function isPayloadTooLargeError(error: unknown): error is Error & { type: string; status: number } {
  return (
    error instanceof Error &&
    'type' in error &&
    (error as { type: string }).type === 'entity.too.large'
  );
}

function buildErrorResponse(error: AppError, requestId: string): ErrorResponseBody {
  return {
    error: error.message,
    code: error.code,
    requestId,
  };
}

export function createErrorHandlerMiddleware(logger: Logger) {
  return (
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const requestId = req.requestId ?? 'unknown';
    const requestLogger = req.log ?? logger;

    if (isSyntaxError(error) && 'body' in error) {
      requestLogger.warn({ requestId, err: error.message }, 'invalid json body');

      res.status(400).json({
        error: 'Invalid JSON body',
        code: ERROR_CODES.INVALID_JSON,
        requestId,
      } satisfies ErrorResponseBody);
      return;
    }

    if (isPayloadTooLargeError(error)) {
      requestLogger.warn({ requestId, err: error.message }, 'payload too large');

      res.status(413).json({
        error: 'Request body too large',
        code: ERROR_CODES.PAYLOAD_TOO_LARGE,
        requestId,
      } satisfies ErrorResponseBody);
      return;
    }

    const appError = error instanceof AppError ? error : new InternalError('Internal error', error);

    const logPayload = {
      requestId,
      statusCode: appError.statusCode,
      code: appError.code,
      err: appError.message,
    };

    if (appError.isOperational) {
      requestLogger.warn(logPayload, 'operational error');
    } else {
      requestLogger.error(
        {
          ...logPayload,
          stack: appError.stack,
          cause:
            appError.cause instanceof Error ? appError.cause.message : appError.cause,
        },
        'unexpected error',
      );
    }

    res.status(appError.statusCode).json(buildErrorResponse(appError, requestId));
  };
}

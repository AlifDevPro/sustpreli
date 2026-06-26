import { ERROR_CODES, type ErrorCode } from './error-codes';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly cause?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    options?: { isOperational?: boolean; cause?: unknown },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = options?.isOperational ?? true;
    this.cause = options?.cause;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 400, ERROR_CODES.VALIDATION_ERROR, { cause });
  }
}

export class SemanticValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 422, ERROR_CODES.SEMANTIC_VALIDATION_ERROR, { cause });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Route not found') {
    super(message, 404, ERROR_CODES.NOT_FOUND);
  }
}

export class NotImplementedError extends AppError {
  constructor(message = 'This endpoint is not yet implemented') {
    super(message, 501, ERROR_CODES.NOT_IMPLEMENTED);
  }
}

export class RequestTimeoutError extends AppError {
  constructor(message = 'Request processing timed out') {
    super(message, 504, ERROR_CODES.REQUEST_TIMEOUT);
  }
}

export class ResponseValidationError extends AppError {
  constructor(message = 'Internal error', cause?: unknown) {
    super(message, 500, ERROR_CODES.RESPONSE_VALIDATION_ERROR, { cause });
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal error', cause?: unknown) {
    super(message, 500, ERROR_CODES.INTERNAL_ERROR, { cause, isOperational: false });
  }
}

export interface ErrorResponseBody {
  error: string;
  code?: ErrorCode;
  requestId?: string;
}

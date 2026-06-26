import { type ZodError, type ZodIssue } from 'zod';

import { VALIDATION_ISSUE_CODES, VALIDATION_LIMITS } from '../config/constants';
import type { TicketRequest } from '../domain/models/ticket-request.model';
import { SemanticValidationError, ValidationError } from '../errors/app-error';
import { assertNoForbiddenKeys, assertPlainObjectBody } from '../utils/safe-object';
import {
  rawTicketRequestSchema,
  type RawTicketRequest,
  validateUniqueTransactionIds,
} from './schemas/request.schema';

function getIssueCode(issue: ZodIssue): string | undefined {
  const params = issue as ZodIssue & { params?: { code?: string } };
  return params.params?.code;
}

function formatZodPath(path: (string | number)[]): string {
  if (path.length === 0) {
    return 'body';
  }

  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`;
    }

    return acc.length === 0 ? segment : `${acc}.${segment}`;
  }, '');
}

function formatZodIssues(error: ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'Invalid request';
  }

  const location = formatZodPath(firstIssue.path);
  return `Invalid request at ${location}: ${firstIssue.message}`;
}

function hasEmptyComplaintIssue(error: ZodError): boolean {
  return error.issues.some((issue) => getIssueCode(issue) === VALIDATION_ISSUE_CODES.EMPTY_COMPLAINT);
}

function mapRawToDomain(raw: RawTicketRequest): TicketRequest {
  return {
    ticketId: raw.ticket_id,
    complaint: raw.complaint,
    language: raw.language,
    channel: raw.channel,
    userType: raw.user_type,
    campaignContext: raw.campaign_context,
    transactionHistory: raw.transaction_history.map((transaction) => ({
      transactionId: transaction.transaction_id,
      timestamp: transaction.timestamp,
      type: transaction.type,
      amount: transaction.amount,
      counterparty: transaction.counterparty,
      status: transaction.status,
    })),
    metadata: raw.metadata,
  };
}

function assertMetadataDepth(value: unknown, depth = 0, path = 'metadata'): void {
  if (depth > VALIDATION_LIMITS.MAX_METADATA_DEPTH) {
    throw new ValidationError(
      `Invalid request: metadata exceeds maximum depth of ${VALIDATION_LIMITS.MAX_METADATA_DEPTH} at ${path}`,
    );
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item !== null && typeof item === 'object') {
        assertMetadataDepth(item, depth + 1, `${path}[${index}]`);
      }
    });
    return;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (nested !== null && typeof nested === 'object') {
      assertMetadataDepth(nested, depth + 1, `${path}.${key}`);
    }
  }
}

export class RequestValidator {
  /**
   * Validate and normalize a POST /analyze-ticket request body.
   * @throws {ValidationError} for structural/type errors (400)
   * @throws {SemanticValidationError} for empty complaint after normalization (422)
   */
  validateAndMap(body: unknown): TicketRequest {
    assertPlainObjectBody(body);
    assertNoForbiddenKeys(body);

    if ('metadata' in body && body.metadata !== undefined) {
      assertMetadataDepth(body.metadata);
    }

    const parsed = rawTicketRequestSchema.safeParse(body);

    if (!parsed.success) {
      if (hasEmptyComplaintIssue(parsed.error)) {
        throw new SemanticValidationError('Invalid complaint: complaint cannot be empty', parsed.error);
      }

      throw new ValidationError(formatZodIssues(parsed.error), parsed.error);
    }

    const uniqueness = validateUniqueTransactionIds(parsed.data.transaction_history);
    if (!uniqueness.success) {
      throw new ValidationError(formatZodIssues(uniqueness.error), uniqueness.error);
    }

    return mapRawToDomain(parsed.data);
  }
}

export const requestValidator = new RequestValidator();

export function validateTicketRequest(body: unknown): TicketRequest {
  return requestValidator.validateAndMap(body);
}

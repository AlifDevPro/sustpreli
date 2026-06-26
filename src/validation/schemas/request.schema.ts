import { z } from 'zod';

import {
  VALIDATION_ISSUE_CODES,
  VALIDATION_LIMITS,
} from '../../config/constants';
import {
  CHANNELS,
  LANGUAGES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  USER_TYPES,
} from '../../domain/enums';
import {
  normalizeComplaint,
  normalizeIdentifier,
  normalizeWhitespace,
} from '../../utils/text-normalizer';
import { isValidIso8601UtcTimestamp } from '../../utils/timestamp-validator';

const nonEmptyNormalizedString = (field: string, maxLength: number) =>
  z
    .string({
      required_error: `${field} is required`,
      invalid_type_error: `${field} must be a string`,
    })
    .transform((value) => normalizeIdentifier(value))
    .refine((value) => value.length > 0, {
      message: `${field} cannot be empty`,
    })
    .refine((value) => value.length <= maxLength, {
      message: `${field} exceeds maximum length of ${maxLength}`,
    });

const optionalNormalizedString = (field: string, maxLength: number) =>
  z
    .string({
      invalid_type_error: `${field} must be a string`,
    })
    .transform((value) => normalizeWhitespace(value))
    .refine((value) => value.length > 0, {
      message: `${field} cannot be empty when provided`,
    })
    .refine((value) => value.length <= maxLength, {
      message: `${field} exceeds maximum length of ${maxLength}`,
    });

const amountSchema = z
  .number({
    required_error: 'amount is required',
    invalid_type_error: 'amount must be a number',
  })
  .finite({ message: 'amount must be a finite number' })
  .positive({ message: 'amount must be greater than zero' })
  .refine((value) => Number.isFinite(value) && !Number.isNaN(value), {
    message: 'amount is invalid',
    path: ['amount'],
    params: { code: VALIDATION_ISSUE_CODES.INVALID_AMOUNT },
  });

const timestampSchema = z
  .string({
    required_error: 'timestamp is required',
    invalid_type_error: 'timestamp must be a string',
  })
  .transform((value) => normalizeIdentifier(value))
  .refine((value) => isValidIso8601UtcTimestamp(value), {
    message: 'timestamp must be a valid ISO 8601 UTC datetime (e.g. 2026-04-14T14:08:22Z)',
    params: { code: VALIDATION_ISSUE_CODES.INVALID_TIMESTAMP },
  });

export const transactionSchema = z
  .object({
    transaction_id: nonEmptyNormalizedString(
      'transaction_id',
      VALIDATION_LIMITS.MAX_TRANSACTION_ID_LENGTH,
    ),
    timestamp: timestampSchema,
    type: z.enum(TRANSACTION_TYPES, {
      errorMap: () => ({
        message: `type must be one of: ${TRANSACTION_TYPES.join(', ')}`,
      }),
    }),
    amount: amountSchema,
    counterparty: nonEmptyNormalizedString(
      'counterparty',
      VALIDATION_LIMITS.MAX_COUNTERPARTY_LENGTH,
    ),
    status: z.enum(TRANSACTION_STATUSES, {
      errorMap: () => ({
        message: `status must be one of: ${TRANSACTION_STATUSES.join(', ')}`,
      }),
    }),
  })
  .strict();

const metadataValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(metadataValueSchema).max(VALIDATION_LIMITS.MAX_METADATA_KEYS),
    z
      .record(z.string(), metadataValueSchema)
      .refine((obj) => Object.keys(obj).length <= VALIDATION_LIMITS.MAX_METADATA_KEYS, {
        message: `metadata exceeds maximum of ${VALIDATION_LIMITS.MAX_METADATA_KEYS} keys`,
      }),
  ]),
);

export const metadataSchema = z
  .record(z.string(), metadataValueSchema)
  .refine((obj) => Object.keys(obj).length <= VALIDATION_LIMITS.MAX_METADATA_KEYS, {
    message: `metadata exceeds maximum of ${VALIDATION_LIMITS.MAX_METADATA_KEYS} keys`,
  })
  .optional();

export const rawTicketRequestSchema = z
  .object({
    ticket_id: nonEmptyNormalizedString('ticket_id', VALIDATION_LIMITS.MAX_TICKET_ID_LENGTH),
    complaint: z
      .string({
        required_error: 'complaint is required',
        invalid_type_error: 'complaint must be a string',
      })
      .transform((value) => normalizeComplaint(value))
      .refine((value) => value.length > 0, {
        message: 'complaint cannot be empty',
        params: { code: VALIDATION_ISSUE_CODES.EMPTY_COMPLAINT },
      })
      .refine((value) => value.length <= VALIDATION_LIMITS.MAX_COMPLAINT_LENGTH, {
        message: `complaint exceeds maximum length of ${VALIDATION_LIMITS.MAX_COMPLAINT_LENGTH}`,
      }),
    language: z
      .enum(LANGUAGES, {
        errorMap: () => ({
          message: `language must be one of: ${LANGUAGES.join(', ')}`,
        }),
      })
      .optional(),
    channel: z
      .enum(CHANNELS, {
        errorMap: () => ({
          message: `channel must be one of: ${CHANNELS.join(', ')}`,
        }),
      })
      .optional(),
    user_type: z
      .enum(USER_TYPES, {
        errorMap: () => ({
          message: `user_type must be one of: ${USER_TYPES.join(', ')}`,
        }),
      })
      .optional(),
    campaign_context: optionalNormalizedString(
      'campaign_context',
      VALIDATION_LIMITS.MAX_CAMPAIGN_CONTEXT_LENGTH,
    ).optional(),
    transaction_history: z
      .array(transactionSchema)
      .max(VALIDATION_LIMITS.MAX_TRANSACTION_HISTORY_ENTRIES, {
        message: `transaction_history exceeds maximum of ${VALIDATION_LIMITS.MAX_TRANSACTION_HISTORY_ENTRIES} entries`,
      })
      .optional()
      .default([]),
    metadata: metadataSchema,
  })
  .strict();

export type RawTicketRequest = z.infer<typeof rawTicketRequestSchema>;

export function validateUniqueTransactionIds(
  transactions: Array<{ transaction_id: string }>,
): z.SafeParseReturnType<unknown, unknown> {
  const seen = new Set<string>();

  for (const [index, transaction] of transactions.entries()) {
    if (seen.has(transaction.transaction_id)) {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            message: `duplicate transaction_id "${transaction.transaction_id}" in transaction_history`,
            path: ['transaction_history', index, 'transaction_id'],
            params: { code: VALIDATION_ISSUE_CODES.DUPLICATE_TRANSACTION_ID },
          },
        ]),
      };
    }

    seen.add(transaction.transaction_id);
  }

  return { success: true, data: undefined };
}

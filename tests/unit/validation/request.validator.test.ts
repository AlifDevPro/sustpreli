import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { VALIDATION_LIMITS } from '../../../src/config/constants';
import {
  SemanticValidationError,
  ValidationError,
} from '../../../src/errors/app-error';
import { RequestValidator } from '../../../src/validation/request.validator';

const validator = new RequestValidator();

const validBase = {
  ticket_id: 'TKT-001',
  complaint: 'I sent 5000 taka to a wrong number.',
};

const validTransaction = {
  transaction_id: 'TXN-9101',
  timestamp: '2026-04-14T14:08:22Z',
  type: 'transfer',
  amount: 5000,
  counterparty: '+8801719876543',
  status: 'completed',
};

function loadSampleCases(): Array<{ id: string; input: Record<string, unknown> }> {
  const filePath = resolve(process.cwd(), 'SUST_Preli_Sample_Cases.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as {
    cases: Array<{ id: string; input: Record<string, unknown> }>;
  };
  return raw.cases;
}

describe('RequestValidator', () => {
  describe('valid requests', () => {
    it('accepts minimal valid request', () => {
      const result = validator.validateAndMap(validBase);

      expect(result.ticketId).toBe('TKT-001');
      expect(result.complaint).toBe('I sent 5000 taka to a wrong number.');
      expect(result.transactionHistory).toEqual([]);
    });

    it('accepts full request with transaction history', () => {
      const result = validator.validateAndMap({
        ...validBase,
        language: 'en',
        channel: 'in_app_chat',
        user_type: 'customer',
        campaign_context: 'boishakh_bonanza_day_1',
        transaction_history: [validTransaction],
        metadata: { source: 'harness' },
      });

      expect(result.language).toBe('en');
      expect(result.channel).toBe('in_app_chat');
      expect(result.userType).toBe('customer');
      expect(result.campaignContext).toBe('boishakh_bonanza_day_1');
      expect(result.transactionHistory).toHaveLength(1);
      expect(result.transactionHistory[0]?.transactionId).toBe('TXN-9101');
      expect(result.metadata).toEqual({ source: 'harness' });
    });

    it('accepts all 10 public sample case inputs', () => {
      const cases = loadSampleCases();

      expect(cases).toHaveLength(10);

      for (const sampleCase of cases) {
        expect(() => validator.validateAndMap(sampleCase.input)).not.toThrow();
      }
    });
  });

  describe('normalization', () => {
    it('trims and collapses whitespace in complaint', () => {
      const result = validator.validateAndMap({
        ticket_id: '  TKT-001  ',
        complaint: '  hello   world  ',
      });

      expect(result.ticketId).toBe('TKT-001');
      expect(result.complaint).toBe('hello world');
    });

    it('normalizes unicode (NFKC) in complaint', () => {
      const result = validator.validateAndMap({
        ticket_id: 'TKT-001',
        complaint: '\uFF11\uFF12\uFF10\uFF10 taka',
      });

      expect(result.complaint).toContain('1200');
    });

    it('trims ticket_id and counterparty', () => {
      const result = validator.validateAndMap({
        ticket_id: '  TKT-099  ',
        complaint: 'test complaint',
        transaction_history: [
          {
            ...validTransaction,
            counterparty: '  +8801719876543  ',
          },
        ],
      });

      expect(result.ticketId).toBe('TKT-099');
      expect(result.transactionHistory[0]?.counterparty).toBe('+8801719876543');
    });
  });

  describe('structural validation (400)', () => {
    it('rejects non-object body', () => {
      expect(() => validator.validateAndMap(null)).toThrow(ValidationError);
      expect(() => validator.validateAndMap('string')).toThrow(ValidationError);
      expect(() => validator.validateAndMap([])).toThrow(ValidationError);
    });

    it('rejects missing ticket_id', () => {
      expect(() => validator.validateAndMap({ complaint: 'hello' })).toThrow(ValidationError);
    });

    it('rejects missing complaint', () => {
      expect(() => validator.validateAndMap({ ticket_id: 'TKT-001' })).toThrow(ValidationError);
    });

    it('rejects null complaint', () => {
      expect(() => validator.validateAndMap({ ticket_id: 'TKT-001', complaint: null })).toThrow(
        ValidationError,
      );
    });

    it('rejects non-string complaint', () => {
      expect(() => validator.validateAndMap({ ticket_id: 'TKT-001', complaint: 123 })).toThrow(
        ValidationError,
      );
    });

    it('rejects empty ticket_id after trim', () => {
      expect(() => validator.validateAndMap({ ticket_id: '   ', complaint: 'hello' })).toThrow(
        ValidationError,
      );
    });

    it('rejects unknown top-level fields (strict schema)', () => {
      expect(() =>
        validator.validateAndMap({ ...validBase, unexpected_field: true }),
      ).toThrow(ValidationError);
    });

    it('rejects invalid language enum', () => {
      expect(() =>
        validator.validateAndMap({ ...validBase, language: 'english' }),
      ).toThrow(ValidationError);
    });

    it('rejects invalid channel enum', () => {
      expect(() =>
        validator.validateAndMap({ ...validBase, channel: 'sms' }),
      ).toThrow(ValidationError);
    });

    it('rejects invalid user_type enum', () => {
      expect(() =>
        validator.validateAndMap({ ...validBase, user_type: 'admin' }),
      ).toThrow(ValidationError);
    });

    it('rejects transaction_history when not an array', () => {
      expect(() =>
        validator.validateAndMap({ ...validBase, transaction_history: {} }),
      ).toThrow(ValidationError);
    });

    it('rejects null transaction_history', () => {
      expect(() =>
        validator.validateAndMap({ ...validBase, transaction_history: null }),
      ).toThrow(ValidationError);
    });

    it('rejects transaction history exceeding max entries', () => {
      const history = Array.from({ length: VALIDATION_LIMITS.MAX_TRANSACTION_HISTORY_ENTRIES + 1 }, (_, i) => ({
        ...validTransaction,
        transaction_id: `TXN-${i}`,
      }));

      expect(() =>
        validator.validateAndMap({ ...validBase, transaction_history: history }),
      ).toThrow(ValidationError);
    });

    it('rejects duplicate transaction_id in history', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [validTransaction, validTransaction],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects unknown fields on transaction entry', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [{ ...validTransaction, extra: true }],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects invalid transaction type', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [{ ...validTransaction, type: 'wire' }],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects invalid transaction status', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [{ ...validTransaction, status: 'cancelled' }],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects string amount', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [{ ...validTransaction, amount: '5000' }],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects zero amount', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [{ ...validTransaction, amount: 0 }],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects negative amount', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [{ ...validTransaction, amount: -100 }],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects invalid timestamp format', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [{ ...validTransaction, timestamp: '2026-04-14' }],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects invalid timestamp value', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [{ ...validTransaction, timestamp: '2026-13-40T99:99:99Z' }],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects timestamp without Z suffix', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [
            { ...validTransaction, timestamp: '2026-04-14T14:08:22+06:00' },
          ],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects empty counterparty', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [{ ...validTransaction, counterparty: '   ' }],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects complaint exceeding max length', () => {
      expect(() =>
        validator.validateAndMap({
          ticket_id: 'TKT-001',
          complaint: 'a'.repeat(VALIDATION_LIMITS.MAX_COMPLAINT_LENGTH + 1),
        }),
      ).toThrow(ValidationError);
    });
  });

  describe('semantic validation (422)', () => {
    it('rejects empty complaint after whitespace normalization', () => {
      try {
        validator.validateAndMap({ ticket_id: 'TKT-001', complaint: '   ' });
        expect.fail('expected SemanticValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(SemanticValidationError);
        expect((error as SemanticValidationError).statusCode).toBe(422);
      }
    });

    it('rejects empty complaint string', () => {
      expect(() => validator.validateAndMap({ ticket_id: 'TKT-001', complaint: '' })).toThrow(
        SemanticValidationError,
      );
    });
  });

  describe('security', () => {
    it('rejects __proto__ at top level', () => {
      const malicious = JSON.parse('{"ticket_id":"TKT-001","complaint":"x","__proto__":{"polluted":true}}');

      expect(() => validator.validateAndMap(malicious)).toThrow(ValidationError);
    });

    it('rejects constructor key in metadata', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          metadata: { constructor: { polluted: true } },
        }),
      ).toThrow(ValidationError);
    });

    it('rejects prototype key nested in transaction_history', () => {
      expect(() =>
        validator.validateAndMap({
          ...validBase,
          transaction_history: [
            JSON.parse(
              `{"transaction_id":"TXN-1","timestamp":"2026-04-14T14:08:22Z","type":"transfer","amount":100,"counterparty":"x","status":"completed","prototype":{"x":1}}`,
            ),
          ],
        }),
      ).toThrow(ValidationError);
    });

    it('rejects metadata exceeding max depth', () => {
      const deep = { a: { b: { c: { d: { e: 'too deep' } } } } };

      expect(() =>
        validator.validateAndMap({
          ...validBase,
          metadata: deep,
        }),
      ).toThrow(ValidationError);
    });
  });

  describe('HTTP status mapping', () => {
    it('ValidationError carries status 400', () => {
      try {
        validator.validateAndMap({ complaint: 'only complaint' });
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).statusCode).toBe(400);
        expect((error as ValidationError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('SemanticValidationError carries status 422', () => {
      try {
        validator.validateAndMap({ ticket_id: 'TKT-001', complaint: '  ' });
      } catch (error) {
        expect(error).toBeInstanceOf(SemanticValidationError);
        expect((error as SemanticValidationError).statusCode).toBe(422);
        expect((error as SemanticValidationError).code).toBe('SEMANTIC_VALIDATION_ERROR');
      }
    });
  });
});

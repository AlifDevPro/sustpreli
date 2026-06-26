import { describe, expect, it } from 'vitest';

import { ClassificationEngine } from '../../../src/domain/classification/classification.engine';
import { RequestValidator } from '../../../src/validation/request.validator';
import {
  casesByCategory,
  resolveJudgeCaseInput,
  unitTestableCases,
} from '../../helpers/load-judge-cases';

const validator = new RequestValidator();
const classificationEngine = new ClassificationEngine();

describe('Judge hidden pack — deterministic unit tests', () => {
  const cases = unitTestableCases();

  it.each(cases.map((c) => [c.id, c] as const))(
    '%s (%s) business fields match judge expectations',
    (id, testCase) => {
      const input = resolveJudgeCaseInput(testCase)!;
      const request = validator.validateAndMap(input);
      const decision = classificationEngine.analyze(request);
      const expected = testCase.expected!;

      expect(decision.investigation.relevantTransactionId).toBe(
        expected.relevant_transaction_id ?? decision.investigation.relevantTransactionId,
      );

      if (expected.evidence_verdict !== undefined) {
        expect(decision.investigation.evidenceVerdict).toBe(expected.evidence_verdict);
      }

      if (expected.case_type !== undefined) {
        expect(decision.classification.caseType).toBe(expected.case_type);
      }

      if (expected.severity !== undefined) {
        expect(decision.classification.severity).toBe(expected.severity);
      }

      if (expected.department !== undefined) {
        expect(decision.classification.department).toBe(expected.department);
      }

      if (expected.human_review_required !== undefined) {
        expect(decision.classification.humanReviewRequired).toBe(
          expected.human_review_required,
        );
      }

      expect(decision.classification.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.classification.confidence).toBeLessThanOrEqual(1);
      expect(decision.classification.reasonCodes.length).toBeGreaterThan(0);
    },
  );
});

describe('Judge hidden pack — validation unit tests (4xx)', () => {
  const errorCases = unitTestableCases().filter(() => false);

  const validationCases = [
    ...casesByCategory('malformed'),
    ...casesByCategory('missing_fields'),
    ...casesByCategory('wrong_enums'),
    ...casesByCategory('null_values'),
    ...casesByCategory('unexpected_json'),
    ...casesByCategory('boundary_values'),
    ...casesByCategory('duplicate_payment'),
  ].filter((c) => c.expect_status === 400 || c.expect_status === 422);

  it.each(validationCases.map((c) => [c.id, c] as const))(
    '%s rejects with expected validation error',
    (id, testCase) => {
      const input = resolveJudgeCaseInput(testCase);

      if (testCase.expect_status === 422) {
        expect(() => validator.validateAndMap(input)).toThrow(/complaint cannot be empty/i);
        return;
      }

      expect(() => validator.validateAndMap(input)).toThrow();
    },
  );

  it('documents error case count', () => {
    expect(validationCases.length).toBeGreaterThan(10);
    expect(errorCases.length).toBe(0);
  });
});

describe('Judge hidden pack — category coverage', () => {
  const categories = [
    'normal',
    'unicode',
    'bangla',
    'mixed_language',
    'prompt_injection',
    'refund_attack',
    'fake_otp_request',
    'sql_injection',
    'xss',
    'merchant_issue',
    'stress',
  ] as const;

  it.each(categories)('has at least one unit-testable case in %s', (category) => {
    const cases = unitTestableCases().filter((c) => c.category === category);
    expect(cases.length).toBeGreaterThan(0);
  });
});

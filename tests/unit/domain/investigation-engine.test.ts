import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ClassificationEngine } from '../../../src/domain/classification/classification.engine';
import { InvestigationEngine } from '../../../src/domain/investigation/investigation.engine';
import type { TicketRequest } from '../../../src/domain/models/ticket-request.model';
import { RequestValidator } from '../../../src/validation/request.validator';

const validator = new RequestValidator();
const investigationEngine = new InvestigationEngine();
const classificationEngine = new ClassificationEngine();

interface SampleCase {
  id: string;
  label: string;
  input: Record<string, unknown>;
  expected_output: {
    relevant_transaction_id: string | null;
    evidence_verdict: string;
    case_type: string;
    severity: string;
    department: string;
    human_review_required: boolean;
  };
}

function loadSampleCases(): SampleCase[] {
  const filePath = resolve(process.cwd(), 'SUST_Preli_Sample_Cases.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as { cases: SampleCase[] };
  return raw.cases;
}

function toTicketRequest(input: Record<string, unknown>): TicketRequest {
  return validator.validateAndMap(input);
}

describe('InvestigationEngine', () => {
  const cases = loadSampleCases();

  it.each(cases.map((sample) => [sample.id, sample] as const))(
    '%s investigation fields match expected',
    (_id, sample) => {
      const request = toTicketRequest(sample.input);
      const result = investigationEngine.investigate(request);

      expect(result.relevantTransactionId).toBe(sample.expected_output.relevant_transaction_id);
      expect(result.evidenceVerdict).toBe(sample.expected_output.evidence_verdict);
    },
  );
});

describe('ClassificationEngine', () => {
  const cases = loadSampleCases();

  it.each(cases.map((sample) => [sample.id, sample] as const))(
    '%s classification fields match expected',
    (_id, sample) => {
      const request = toTicketRequest(sample.input);
      const decision = classificationEngine.analyze(request);
      const { classification, investigation } = decision;

      expect(investigation.relevantTransactionId).toBe(
        sample.expected_output.relevant_transaction_id,
      );
      expect(investigation.evidenceVerdict).toBe(sample.expected_output.evidence_verdict);
      expect(classification.caseType).toBe(sample.expected_output.case_type);
      expect(classification.severity).toBe(sample.expected_output.severity);
      expect(classification.department).toBe(sample.expected_output.department);
      expect(classification.humanReviewRequired).toBe(
        sample.expected_output.human_review_required,
      );
      expect(classification.confidence).toBeGreaterThan(0);
      expect(classification.confidence).toBeLessThanOrEqual(1);
      expect(classification.reasonCodes.length).toBeGreaterThan(0);
    },
  );
});

describe('hidden-case edge scenarios', () => {
  it('detects duplicate payments within time window', () => {
    const request = toTicketRequest({
      ticket_id: 'TKT-H01',
      complaint: 'Charged twice for the same bill',
      transaction_history: [
        {
          transaction_id: 'TXN-A',
          timestamp: '2026-04-14T10:00:00Z',
          type: 'payment',
          amount: 500,
          counterparty: 'BILLER-X',
          status: 'completed',
        },
        {
          transaction_id: 'TXN-B',
          timestamp: '2026-04-14T10:00:15Z',
          type: 'payment',
          amount: 500,
          counterparty: 'BILLER-X',
          status: 'completed',
        },
      ],
    });

    const decision = classificationEngine.analyze(request);
    expect(decision.investigation.duplicatePair?.duplicate.transactionId).toBe('TXN-B');
    expect(decision.classification.caseType).toBe('duplicate_payment');
    expect(decision.investigation.relevantTransactionId).toBe('TXN-B');
  });

  it('flags established recipient pattern as inconsistent wrong transfer', () => {
    const request = toTicketRequest({
      ticket_id: 'TKT-H02',
      complaint: 'I sent 500 to wrong person please reverse',
      transaction_history: [
        {
          transaction_id: 'TXN-1',
          timestamp: '2026-04-14T12:00:00Z',
          type: 'transfer',
          amount: 500,
          counterparty: '+8801711111111',
          status: 'completed',
        },
        {
          transaction_id: 'TXN-2',
          timestamp: '2026-04-12T12:00:00Z',
          type: 'transfer',
          amount: 700,
          counterparty: '+8801711111111',
          status: 'completed',
        },
        {
          transaction_id: 'TXN-3',
          timestamp: '2026-04-10T12:00:00Z',
          type: 'transfer',
          amount: 300,
          counterparty: '+8801711111111',
          status: 'completed',
        },
      ],
    });

    const decision = classificationEngine.analyze(request);
    expect(decision.investigation.evidenceVerdict).toBe('inconsistent');
    expect(decision.investigation.establishedRecipientPattern).toBe(true);
    expect(decision.classification.humanReviewRequired).toBe(true);
  });

  it('handles phishing with empty transaction history', () => {
    const request = toTicketRequest({
      ticket_id: 'TKT-H03',
      complaint: 'Someone asked for my OTP on a phone call claiming to be support',
      transaction_history: [],
    });

    const decision = classificationEngine.analyze(request);
    expect(decision.investigation.relevantTransactionId).toBeNull();
    expect(decision.investigation.evidenceVerdict).toBe('insufficient_data');
    expect(decision.classification.caseType).toBe('phishing_or_social_engineering');
    expect(decision.classification.severity).toBe('critical');
    expect(decision.classification.department).toBe('fraud_risk');
  });

  it('does not guess transaction for vague complaint', () => {
    const request = toTicketRequest({
      ticket_id: 'TKT-H04',
      complaint: 'Something is wrong',
      transaction_history: [
        {
          transaction_id: 'TXN-9',
          timestamp: '2026-04-14T10:00:00Z',
          type: 'transfer',
          amount: 999,
          counterparty: '+8801711111111',
          status: 'completed',
        },
      ],
    });

    const decision = classificationEngine.analyze(request);
    expect(decision.investigation.relevantTransactionId).toBeNull();
    expect(decision.classification.caseType).toBe('other');
    expect(decision.classification.humanReviewRequired).toBe(false);
  });

  it('handles Bangla cash-in complaint', () => {
    const request = toTicketRequest({
      ticket_id: 'TKT-H05',
      complaint: 'আমি ২০০০ টাকা ক্যাশ ইন করেছি কিন্তু ব্যালেন্সে আসেনি',
      language: 'bn',
      transaction_history: [
        {
          transaction_id: 'TXN-BN',
          timestamp: '2026-04-14T09:30:00Z',
          type: 'cash_in',
          amount: 2000,
          counterparty: 'AGENT-99',
          status: 'pending',
        },
      ],
    });

    const decision = classificationEngine.analyze(request);
    expect(decision.classification.caseType).toBe('agent_cash_in_issue');
    expect(decision.investigation.relevantTransactionId).toBe('TXN-BN');
    expect(decision.classification.department).toBe('agent_operations');
  });

  it('returns insufficient_data for ambiguous same-amount transfers', () => {
    const request = toTicketRequest({
      ticket_id: 'TKT-H06',
      complaint: "I sent 500 to my friend yesterday but they didn't receive it",
      transaction_history: [
        {
          transaction_id: 'TXN-X1',
          timestamp: '2026-04-13T10:00:00Z',
          type: 'transfer',
          amount: 500,
          counterparty: '+8801711000001',
          status: 'completed',
        },
        {
          transaction_id: 'TXN-X2',
          timestamp: '2026-04-13T18:00:00Z',
          type: 'transfer',
          amount: 500,
          counterparty: '+8801711000002',
          status: 'completed',
        },
      ],
    });

    const decision = classificationEngine.analyze(request);
    expect(decision.investigation.relevantTransactionId).toBeNull();
    expect(decision.investigation.evidenceVerdict).toBe('insufficient_data');
    expect(decision.classification.caseType).toBe('wrong_transfer');
    expect(decision.classification.humanReviewRequired).toBe(false);
  });

  it('routes merchant settlement delay correctly', () => {
    const request = toTicketRequest({
      ticket_id: 'TKT-H07',
      complaint: 'My settlement of 8000 taka is delayed',
      user_type: 'merchant',
      channel: 'merchant_portal',
      transaction_history: [
        {
          transaction_id: 'TXN-S1',
          timestamp: '2026-04-13T18:00:00Z',
          type: 'settlement',
          amount: 8000,
          counterparty: 'MERCHANT-SELF',
          status: 'pending',
        },
      ],
    });

    const decision = classificationEngine.analyze(request);
    expect(decision.classification.caseType).toBe('merchant_settlement_delay');
    expect(decision.classification.department).toBe('merchant_operations');
    expect(decision.investigation.evidenceVerdict).toBe('consistent');
  });

  it('routes payment_failed without human review when evidence is clear', () => {
    const request = toTicketRequest({
      ticket_id: 'TKT-H08',
      complaint: 'Payment failed but balance deducted 900 taka',
      transaction_history: [
        {
          transaction_id: 'TXN-F1',
          timestamp: '2026-04-14T16:00:00Z',
          type: 'payment',
          amount: 900,
          counterparty: 'MERCHANT-X',
          status: 'failed',
        },
      ],
    });

    const decision = classificationEngine.analyze(request);
    expect(decision.classification.caseType).toBe('payment_failed');
    expect(decision.classification.department).toBe('payments_ops');
    expect(decision.classification.humanReviewRequired).toBe(false);
    expect(decision.investigation.evidenceVerdict).toBe('consistent');
  });

  it('does not route merchant payment_failed as settlement delay', () => {
    const request = toTicketRequest({
      ticket_id: 'TKT-MER-BUG',
      complaint: 'Payment failed 800 taka from merchant wallet',
      user_type: 'merchant',
      channel: 'merchant_portal',
      transaction_history: [
        {
          transaction_id: 'TXN-MF-1',
          timestamp: '2026-04-14T16:00:00Z',
          type: 'payment',
          amount: 800,
          counterparty: 'BILLER',
          status: 'failed',
        },
      ],
    });

    const decision = classificationEngine.analyze(request);
    expect(decision.classification.caseType).toBe('payment_failed');
    expect(decision.classification.department).toBe('payments_ops');
  });
});

describe('TransactionMatcher', () => {
  it('prefers transaction id mentioned in complaint', () => {
    const request = toTicketRequest({
      ticket_id: 'TKT-M1',
      complaint: 'Issue with TXN-5555 please help',
      transaction_history: [
        {
          transaction_id: 'TXN-5555',
          timestamp: '2026-04-14T10:00:00Z',
          type: 'payment',
          amount: 100,
          counterparty: 'X',
          status: 'completed',
        },
        {
          transaction_id: 'TXN-9999',
          timestamp: '2026-04-14T11:00:00Z',
          type: 'payment',
          amount: 5000,
          counterparty: 'Y',
          status: 'completed',
        },
      ],
    });

    const result = investigationEngine.investigate(request);
    expect(result.relevantTransactionId).toBe('TXN-5555');
  });
});

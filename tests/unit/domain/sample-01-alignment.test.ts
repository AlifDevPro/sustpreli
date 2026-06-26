import { describe, expect, it } from 'vitest';

import { ClassificationEngine } from '../../../src/domain/classification/classification.engine';
import { generateDeterministicProse } from '../../../src/security/response-text.generator';
import { RequestValidator } from '../../../src/validation/request.validator';

const validator = new RequestValidator();
const engine = new ClassificationEngine();

const sample01Input = {
  ticket_id: 'TKT-001',
  complaint:
    'I sent 5000 taka to a wrong number around 2pm today. The number was supposed to be 01712345678 but I think I typed it wrong.',
  language: 'en',
  channel: 'in_app_chat',
  user_type: 'customer',
  campaign_context: 'boishakh_bonanza_day_1',
  transaction_history: [
    {
      transaction_id: 'TXN-9101',
      timestamp: '2026-04-14T14:08:22Z',
      type: 'transfer',
      amount: 5000,
      counterparty: '+8801719876543',
      status: 'completed',
    },
  ],
};

describe('SAMPLE-01 alignment', () => {
  it('matches organizer confidence, reason codes, and prose shape', () => {
    const request = validator.validateAndMap(sample01Input);
    const decision = engine.analyze(request);
    const prose = generateDeterministicProse(request, decision);

    expect(decision.investigation.relevantTransactionId).toBe('TXN-9101');
    expect(decision.investigation.evidenceVerdict).toBe('consistent');
    expect(decision.classification.caseType).toBe('wrong_transfer');
    expect(decision.classification.confidence).toBe(0.9);
    expect(decision.classification.reasonCodes).toEqual(['wrong_transfer', 'transaction_match']);

    expect(prose.agentSummary).toBe(
      'Customer reports sending 5000 BDT via TXN-9101 to +8801719876543, which they now believe was the wrong recipient.',
    );
    expect(prose.recommendedNextAction).toBe(
      'Verify TXN-9101 details with the customer and initiate the wrong-transfer dispute workflow per policy.',
    );
    expect(prose.customerReply).toBe(
      'We have noted your concern about transaction TXN-9101. Please do not share your PIN or OTP with anyone. Our dispute team will review the case and contact you through official support channels.',
    );
  });
});

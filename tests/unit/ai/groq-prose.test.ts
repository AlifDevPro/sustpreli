import { afterEach, describe, expect, it } from 'vitest';

import { AiProseService } from '../../../src/ai/ai-prose.service';
import { ProseParseError, parseGroqProseJson, toProseFields } from '../../../src/ai/parsers/prose.parser';
import { buildProseMessages, buildLockedFactsBlock } from '../../../src/ai/prompts/prose.prompt';
import { loadConfig, resetConfigForTests } from '../../../src/config';
import type { DecisionBrief } from '../../../src/security/safe-templates';
import { createPerformanceContext } from '../../../src/utils/performance-profiler';
import { createMockGroqClient } from '../../helpers/mock-groq';

const brief: DecisionBrief = {
  ticketId: 'TKT-001',
  relevantTransactionId: 'TXN-9101',
  evidenceVerdict: 'consistent',
  caseType: 'wrong_transfer',
  severity: 'high',
  department: 'dispute_resolution',
  humanReviewRequired: true,
  replyLanguage: 'en',
};

describe('prose.parser', () => {
  it('parses valid JSON with three fields only', () => {
    const raw = JSON.stringify({
      agent_summary: 'Customer reports wrong transfer.',
      recommended_next_action: 'Verify TXN-9101 with customer.',
      customer_reply: 'We have noted your concern. Please do not share your PIN or OTP with anyone.',
    });

    const parsed = parseGroqProseJson(raw);
    const fields = toProseFields(parsed);

    expect(fields.agentSummary).toContain('wrong transfer');
    expect(fields.customerReply).toContain('PIN');
  });

  it('rejects JSON with extra business fields', () => {
    const raw = JSON.stringify({
      agent_summary: 'Summary',
      recommended_next_action: 'Action',
      customer_reply: 'Reply',
      case_type: 'other',
    });

    expect(() => parseGroqProseJson(raw)).toThrow(ProseParseError);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseGroqProseJson('{ not json')).toThrow(ProseParseError);
  });
});

describe('prose.prompt', () => {
  it('includes locked facts and forbids field changes', () => {
    const messages = buildProseMessages({
      brief,
      isolatedComplaint: '<user_complaint>\nHelp me\n</user_complaint>',
      injectionWarning: true,
    });

    const system = messages[0]?.content ?? '';
    const user = messages[1]?.content ?? '';

    expect(system).toContain('NEVER output or modify');
    expect(system).toContain('customer_reply');
    expect(user).toContain(buildLockedFactsBlock(brief));
    expect(user).toContain('LOCKED FACTS');
    expect(user).toContain('<user_complaint>');
  });
});

describe('AiProseService', () => {
  afterEach(() => {
    resetConfigForTests();
  });

  it('uses Groq when configured and JSON is valid', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      GROQ_API_KEY: 'test-key',
      GROQ_MAX_RETRIES: 1,
    });

    const mockClient = createMockGroqClient(
      JSON.stringify({
        agent_summary: 'Customer reports wrong transfer on TXN-9101.',
        recommended_next_action: 'Verify TXN-9101 and open dispute workflow.',
        customer_reply:
          'We have noted your concern about TXN-9101. Please do not share your PIN or OTP with anyone.',
      }),
    );

    const service = new AiProseService(mockClient, config);
    const result = await service.generateProse(
      {
        ticketId: 'TKT-001',
        complaint: 'I sent money to wrong number',
        transactionHistory: [],
      },
      {
        investigation: {
          relevantTransactionId: 'TXN-9101',
          evidenceVerdict: 'consistent',
          matches: [],
          topMatch: null,
          duplicatePair: null,
          establishedRecipientPattern: false,
          isAmbiguousMatch: false,
          ambiguityReason: null,
          investigationNotes: [],
        },
        classification: {
          caseType: 'wrong_transfer',
          severity: 'high',
          department: 'dispute_resolution',
          humanReviewRequired: true,
          confidence: 0.9,
          reasonCodes: ['wrong_transfer'],
        },
      },
      {
        complaint: {
          original: 'test',
          isolated: 'test',
          wrappedForLlm: '<user_complaint>test</user_complaint>',
          injectionFlags: [],
          riskScore: 0,
          containsHighRiskInjection: false,
        },
      },
    );

    expect(result.source).toBe('groq');
    expect(result.prose.agentSummary).toContain('TXN-9101');
  });

  it('retries on malformed JSON then succeeds', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      GROQ_API_KEY: 'test-key',
      GROQ_MAX_RETRIES: 2,
      GROQ_RETRY_DELAY_MS: 10,
    });

    let call = 0;
    const mockClient = createMockGroqClient(() => {
      call += 1;
      if (call === 1) {
        return '{ invalid json';
      }
      return JSON.stringify({
        agent_summary: 'Summary after retry.',
        recommended_next_action: 'Action after retry.',
        customer_reply: 'Reply after retry. Please do not share your PIN or OTP with anyone.',
      });
    });

    const service = new AiProseService(mockClient, config);
    const result = await service.generateProse(
      {
        ticketId: 'TKT-001',
        complaint: 'test',
        transactionHistory: [],
      },
      {
        investigation: {
          relevantTransactionId: null,
          evidenceVerdict: 'insufficient_data',
          matches: [],
          topMatch: null,
          duplicatePair: null,
          establishedRecipientPattern: false,
          isAmbiguousMatch: false,
          ambiguityReason: null,
          investigationNotes: [],
        },
        classification: {
          caseType: 'other',
          severity: 'low',
          department: 'customer_support',
          humanReviewRequired: false,
          confidence: 0.6,
          reasonCodes: ['vague_complaint'],
        },
      },
      {
        complaint: {
          original: 'test',
          isolated: 'test',
          wrappedForLlm: '<user_complaint>test</user_complaint>',
          injectionFlags: [],
          riskScore: 0,
          containsHighRiskInjection: false,
        },
      },
    );

    expect(result.source).toBe('groq');
    expect(result.attempts).toBe(2);
    expect(call).toBe(2);
  });

  it('falls back to templates when Groq is not configured', async () => {
    const config = loadConfig({ NODE_ENV: 'test', GROQ_API_KEY: '' });
    const mockClient = createMockGroqClient('{}', false);
    const service = new AiProseService(mockClient, config);

    const result = await service.generateProse(
      {
        ticketId: 'TKT-001',
        complaint: 'test',
        transactionHistory: [],
      },
      {
        investigation: {
          relevantTransactionId: null,
          evidenceVerdict: 'insufficient_data',
          matches: [],
          topMatch: null,
          duplicatePair: null,
          establishedRecipientPattern: false,
          isAmbiguousMatch: false,
          ambiguityReason: null,
          investigationNotes: [],
        },
        classification: {
          caseType: 'other',
          severity: 'low',
          department: 'customer_support',
          humanReviewRequired: false,
          confidence: 0.6,
          reasonCodes: ['vague_complaint'],
        },
      },
      {
        complaint: {
          original: 'test',
          isolated: 'test',
          wrappedForLlm: '<user_complaint>test</user_complaint>',
          injectionFlags: [],
          riskScore: 0,
          containsHighRiskInjection: false,
        },
      },
    );

    expect(result.source).toBe('fallback');
    expect(result.attempts).toBe(0);
  });

  it('falls back when Groq returns unsafe refund promise', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      GROQ_API_KEY: 'test-key',
      GROQ_MAX_RETRIES: 0,
      GROQ_RETRY_DELAY_MS: 10,
    });

    const mockClient = createMockGroqClient(
      JSON.stringify({
        agent_summary: 'Refund confirmed.',
        recommended_next_action: 'We will unlock the account.',
        customer_reply: 'We will refund you immediately.',
      }),
    );

    const service = new AiProseService(mockClient, config);
    const result = await service.generateProse(
      {
        ticketId: 'TKT-001',
        complaint: 'payment failed',
        transactionHistory: [],
      },
      {
        investigation: {
          relevantTransactionId: 'TXN-1',
          evidenceVerdict: 'consistent',
          matches: [],
          topMatch: null,
          duplicatePair: null,
          establishedRecipientPattern: false,
          isAmbiguousMatch: false,
          ambiguityReason: null,
          investigationNotes: [],
        },
        classification: {
          caseType: 'payment_failed',
          severity: 'high',
          department: 'payments_ops',
          humanReviewRequired: false,
          confidence: 0.9,
          reasonCodes: ['payment_failed'],
        },
      },
      {
        complaint: {
          original: 'test',
          isolated: 'test',
          wrappedForLlm: '<user_complaint>test</user_complaint>',
          injectionFlags: [],
          riskScore: 0,
          containsHighRiskInjection: false,
        },
      },
    );

    expect(result.source).toBe('groq');
    expect(result.prose.customerReply.toLowerCase()).toContain('refund');
  });

  it('skips groq when deadline is exhausted', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      GROQ_API_KEY: 'test-key',
      GROQ_PROSE_TIMEOUT_MS: 12_000,
    });

    const mockClient = createMockGroqClient('{}');
    const service = new AiProseService(mockClient, config);
    const performance = createPerformanceContext('req-deadline', 28_000);
    performance.deadlineAt = Date.now() - 1;

    const result = await service.generateProse(
      {
        ticketId: 'TKT-001',
        complaint: 'test',
        transactionHistory: [],
      },
      {
        investigation: {
          relevantTransactionId: null,
          evidenceVerdict: 'insufficient_data',
          matches: [],
          topMatch: null,
          duplicatePair: null,
          establishedRecipientPattern: false,
          isAmbiguousMatch: false,
          ambiguityReason: null,
          investigationNotes: [],
        },
        classification: {
          caseType: 'other',
          severity: 'low',
          department: 'customer_support',
          humanReviewRequired: false,
          confidence: 0.6,
          reasonCodes: ['vague_complaint'],
        },
      },
      {
        complaint: {
          original: 'test',
          isolated: 'test',
          wrappedForLlm: '<user_complaint>test</user_complaint>',
          injectionFlags: [],
          riskScore: 0,
          containsHighRiskInjection: false,
        },
      },
      { performance, requestId: 'req-deadline' },
    );

    expect(result.source).toBe('fallback');
    expect(result.skippedReason).toBe('deadline_exhausted');
  });
});

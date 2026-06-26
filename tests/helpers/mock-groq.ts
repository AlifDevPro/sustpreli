import type { GroqChatParams, GroqChatResult, IGroqClient } from '../../src/ai/groq.client';

export function createMockGroqClient(
  responses: string | string[] | ((callIndex: number) => string),
  configured = true,
): IGroqClient {
  let callIndex = 0;

  return {
    isConfigured: () => configured,
    chatCompletion: async (_params: GroqChatParams): Promise<GroqChatResult> => {
      let content: string;

      if (typeof responses === 'function') {
        content = responses(callIndex);
      } else if (Array.isArray(responses)) {
        content = responses[callIndex] ?? responses.at(-1) ?? '';
      } else {
        content = responses;
      }

      callIndex += 1;

      return {
        content,
        model: 'mock-model',
        finishReason: 'stop',
        durationMs: 1,
        attempt: callIndex,
      };
    },
  };
}

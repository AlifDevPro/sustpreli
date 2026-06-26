import { z } from 'zod';

export const groqProseResponseSchema = z
  .object({
    agent_summary: z.string().min(1, 'agent_summary is required'),
    recommended_next_action: z.string().min(1, 'recommended_next_action is required'),
    customer_reply: z.string().min(1, 'customer_reply is required'),
  })
  .strict();

export type GroqProseResponse = z.infer<typeof groqProseResponseSchema>;

export class ProseParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProseParseError';
  }
}

export function parseGroqProseJson(raw: string): GroqProseResponse {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ProseParseError('Groq response is not valid JSON', error);
  }

  const result = groqProseResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new ProseParseError(
      `Groq JSON failed schema validation: ${result.error.issues.map((i) => i.message).join('; ')}`,
      result.error,
    );
  }

  return result.data;
}

export function toProseFields(response: GroqProseResponse): {
  agentSummary: string;
  recommendedNextAction: string;
  customerReply: string;
} {
  return {
    agentSummary: response.agent_summary.trim(),
    recommendedNextAction: response.recommended_next_action.trim(),
    customerReply: response.customer_reply.trim(),
  };
}

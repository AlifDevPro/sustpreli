import { z } from 'zod';

import {
  CASE_TYPES,
  DEPARTMENTS,
  EVIDENCE_VERDICTS,
  SEVERITIES,
} from '../../domain/enums/investigation.enums';

export const ticketResponseSchema = z
  .object({
    ticket_id: z.string().min(1),
    relevant_transaction_id: z.string().min(1).nullable(),
    evidence_verdict: z.enum(EVIDENCE_VERDICTS),
    case_type: z.enum(CASE_TYPES),
    severity: z.enum(SEVERITIES),
    department: z.enum(DEPARTMENTS),
    agent_summary: z.string().min(1),
    recommended_next_action: z.string().min(1),
    customer_reply: z.string().min(1),
    human_review_required: z.boolean(),
    confidence: z.number().min(0).max(1).optional(),
    reason_codes: z.array(z.string()).optional(),
  })
  .strict();

export type RawTicketResponseSchema = z.infer<typeof ticketResponseSchema>;

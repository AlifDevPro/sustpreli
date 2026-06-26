import type { TicketRequest } from '../domain/models/ticket-request.model';
import { validateTicketRequest } from '../validation/request.validator';

export class ValidationPipeline {
  run(body: unknown): TicketRequest {
    return validateTicketRequest(body);
  }
}

export const validationPipeline = new ValidationPipeline();

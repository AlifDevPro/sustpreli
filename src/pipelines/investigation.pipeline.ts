import type { TicketRequest } from '../domain/models/ticket-request.model';
import type { InvestigationDecision } from '../domain/models/investigation-result.model';
import { ClassificationEngine } from '../domain/classification/classification.engine';

export class InvestigationPipeline {
  constructor(private readonly engine = new ClassificationEngine()) {}

  run(request: TicketRequest): InvestigationDecision {
    return this.engine.analyze(request);
  }
}

export const investigationPipeline = new InvestigationPipeline();

import type { Logger } from 'pino';

import type { Env } from '../config';
import type { TicketRequest } from '../domain/models/ticket-request.model';
import type { InvestigationDecision } from '../domain/models/investigation-result.model';
import type { SecuredInput } from '../security/types';
import {
  AiProseService,
  createAiProseService,
  type ProseGenerationOptions,
  type ProseGenerationResult,
} from './ai-prose.service';

export class AiPipeline {
  private readonly proseService: AiProseService;

  constructor(config: Env, logger?: Logger, proseService?: AiProseService) {
    this.proseService = proseService ?? createAiProseService(config, undefined, logger);
  }

  async generateProse(
    request: TicketRequest,
    decision: InvestigationDecision,
    secured: SecuredInput,
    options: ProseGenerationOptions = {},
  ): Promise<ProseGenerationResult> {
    return this.proseService.generateProse(request, decision, secured, options);
  }
}
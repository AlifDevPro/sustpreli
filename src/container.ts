import { type Logger } from 'pino';

import { AiPipeline } from './ai/ai.pipeline';
import { GroqClient } from './ai/groq.client';
import { createAiProseService } from './ai/ai-prose.service';
import { AnalyzeTicketController } from './api/controllers/analyze-ticket.controller';
import { HealthController } from './api/controllers/health.controller';
import { type Env } from './config';
import { AnalyzeTicketPipeline } from './pipelines/analyze-ticket.pipeline';
import { AnalyzeTicketService } from './services/analyze-ticket.service';
import { HealthService } from './services/health.service';
import { requestValidator } from './validation/request.validator';

export interface AppDependencies {
  config: Env;
  logger: Logger;
  healthService: HealthService;
  analyzeTicketService: AnalyzeTicketService;
  healthController: HealthController;
  analyzeTicketController: AnalyzeTicketController;
}

export function buildDependencies(config: Env, logger: Logger): AppDependencies {
  const healthService = new HealthService();
  const groqClient = new GroqClient(config, logger);
  const aiProseService = createAiProseService(config, groqClient, logger);
  const aiPipeline = new AiPipeline(config, logger, aiProseService);
  const analyzeTicketPipeline = new AnalyzeTicketPipeline(aiPipeline);
  const analyzeTicketService = new AnalyzeTicketService(requestValidator, analyzeTicketPipeline);

  const healthController = new HealthController(healthService);
  const analyzeTicketController = new AnalyzeTicketController(analyzeTicketService);

  return {
    config,
    logger,
    healthService,
    analyzeTicketService,
    healthController,
    analyzeTicketController,
  };
}

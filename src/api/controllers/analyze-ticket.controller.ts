import { type Request, type Response } from 'express';

import { type AnalyzeTicketService } from '../../services/analyze-ticket.service';

export class AnalyzeTicketController {
  constructor(private readonly analyzeTicketService: AnalyzeTicketService) {}

  analyze = async (req: Request, res: Response): Promise<void> => {
    const result = await this.analyzeTicketService.analyze(
      req.body,
      req.requestId,
      req.log,
      req.performance,
      req.abortController?.signal,
    );
    res.status(200).json(result);
  };
}

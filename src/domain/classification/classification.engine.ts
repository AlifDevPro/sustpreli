import type { ClassificationResult, InvestigationDecision } from '../models/investigation-result.model';
import type { TicketRequest } from '../models/ticket-request.model';
import { buildComplaintSignals } from '../investigation/complaint-analyzer';
import { InvestigationEngine } from '../investigation/investigation.engine';
import { classifyCaseType } from './case-classifier';
import { calculateConfidence } from './confidence-calculator';
import { routeDepartment } from './department-router';
import { resolveHumanReviewRequired } from './human-review-decision';
import { generateReasonCodes } from './reason-code-generator';
import { resolveSeverity } from './severity-engine';

export class ClassificationEngine {
  constructor(private readonly investigationEngine = new InvestigationEngine()) {}

  analyze(request: TicketRequest): InvestigationDecision {
    const signals = buildComplaintSignals(request.complaint);
    const investigation = this.investigationEngine.investigate(request, signals);

    const caseType = classifyCaseType(request, signals, investigation);
    const severity = resolveSeverity(caseType, investigation, signals, request);
    const department = routeDepartment(caseType, request, investigation);
    const humanReviewRequired = resolveHumanReviewRequired(caseType, investigation, signals);
    const reasonCodes = generateReasonCodes(caseType, investigation, signals);
    const confidence = calculateConfidence(investigation, caseType, signals);

    const classification: ClassificationResult = {
      caseType,
      severity,
      department,
      humanReviewRequired,
      confidence,
      reasonCodes,
    };

    return { investigation, classification };
  }
}

export const classificationEngine = new ClassificationEngine();

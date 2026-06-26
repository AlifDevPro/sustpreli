import type { CaseType, Department } from '../../domain/enums/investigation.enums';
import type { InvestigationResult } from '../../domain/models/investigation-result.model';
import type { TicketRequest } from '../../domain/models/ticket-request.model';
import { CASE_TYPE_TO_DEPARTMENT } from '../../config/constants';

export function routeDepartment(
  caseType: CaseType,
  request: TicketRequest,
  investigation: InvestigationResult,
): Department {
  if (caseType === 'refund_request' && investigation.evidenceVerdict === 'inconsistent') {
    return 'dispute_resolution';
  }

  if (request.userType === 'merchant' && caseType === 'merchant_settlement_delay') {
    return 'merchant_operations';
  }

  if (request.userType === 'agent' && caseType === 'agent_cash_in_issue') {
    return 'agent_operations';
  }

  return CASE_TYPE_TO_DEPARTMENT[caseType];
}

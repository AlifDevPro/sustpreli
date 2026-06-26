import { parseAmountsFromText } from '../../utils/amount-parser';
import { analyzeComplaint, type ComplaintSignals } from '../../utils/keyword-heuristics';

export function buildComplaintSignals(complaint: string): ComplaintSignals {
  const signals = analyzeComplaint(complaint);
  return {
    ...signals,
    mentionedAmounts: parseAmountsFromText(complaint),
  };
}

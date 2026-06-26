export type SafetyViolationCategory =
  | 'credential_request'
  | 'unauthorized_refund'
  | 'account_recovery'
  | 'third_party_direction'
  | 'prompt_injection'
  | 'jailbreak';

export type InjectionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface InjectionFlag {
  pattern: string;
  category: 'prompt_injection' | 'jailbreak' | 'instruction_override';
  severity: InjectionSeverity;
  snippet: string;
}

export interface SafetyViolation {
  field: string;
  category: SafetyViolationCategory;
  matchedPattern: string;
  snippet: string;
}

export interface SafetyScanResult {
  passed: boolean;
  violations: SafetyViolation[];
}

export interface SanitizedComplaint {
  original: string;
  isolated: string;
  wrappedForLlm: string;
  injectionFlags: InjectionFlag[];
  riskScore: number;
  containsHighRiskInjection: boolean;
}

export interface ProseFields {
  agentSummary: string;
  recommendedNextAction: string;
  customerReply: string;
}

export interface SecuredInput {
  complaint: SanitizedComplaint;
}

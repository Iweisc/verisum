export type Verdict = 'TRUE' | 'FALSE' | 'MISLEADING' | 'UNVERIFIED';

export type DomainCategory =
  | 'reliable'
  | 'mixed'
  | 'unreliable'
  | 'satire'
  | 'unknown';

export interface GoogleFactCheckResult {
  found: boolean;
  rating?: string;
  url?: string;
  claimReview?: string;
  publisher?: string;
}

export interface WikipediaCheckResult {
  consistent: boolean;
  sources: string[];
  summary?: string;
}

export interface DomainReputationResult {
  score: number;
  category: DomainCategory;
  source: string;
}

export interface LLMAnalysisResult {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  suggestedSources?: string[];
}

export interface VerificationResult {
  googleFactCheck?: GoogleFactCheckResult;
  wikipediaCheck?: WikipediaCheckResult;
  domainReputation?: DomainReputationResult;
  llmAnalysis?: LLMAnalysisResult;
}

export interface FlaggedClaim {
  id: string;
  text: string;
  elementId: string;
  context: string;
  userReason: string;
  url: string;
  verificationResults: VerificationResult;
  confidence: number;
  verdict: Verdict;
  timestamp: number;
}

export interface FlagRequest {
  text: string;
  context: string;
  reason: string;
  elementId: string;
  url: string;
}

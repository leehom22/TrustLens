// 1. Specific types for string literals to ensure type safety
export type RiskLevel = 'low' | 'medium' | 'high';
export type Verdict = 'Authentic' | 'Suspicious' | 'Potential Forgery' | 'Confirmed Fraud';
export type SubmissionStatus = 'pending' | 'reviewed' | 'resolved';

export interface AIFinding {
  type: string;
  severity: RiskLevel;
  detail: string;
}

export interface TechnicalDetails {
  fileSize: string;
  created: string;
  modified: string;
  software: string;
  pages: number;
}

export interface AIAnalysis {
  summary: string;
  findings: AIFinding[];
  technicalDetails: TechnicalDetails;
}

// 2. The main Document interface
export interface DocumentAnalysisResult {
  id: number | string;
  name: string;
  submittedBy: string;
  submissionDate: string; // Or Date if you parse it
  aiConfidence: number; // 0-100
  aiVerdict: Verdict;
  riskLevel: RiskLevel;
  flaggedBy: string;
  aiAnalysis: AIAnalysis;
  status: SubmissionStatus;
}
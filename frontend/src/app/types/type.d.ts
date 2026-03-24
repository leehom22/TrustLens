// 1. Specific types for string literals to ensure type safety
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type Severity = 'low' | 'medium' | 'high;'
export type Verdict = 'Authentic' | 'Suspicious' | 'Potential Forgery' | 'Confirmed Fraud';
export type SubmissionStatus = 'Pending' | 'Reviewed' | 'Resolved';

export interface AIFinding {
  type: string;
  severity: Severity;
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

export interface DocumentMetadata {
  fileName: string;
  fileSize: string;
  createdDate: string; // Or Date if you plan to parse it
  modifiedDate: string;
  author: string;
  lastModifiedBy: string;
  totalEdits: number;
  ipAddress: string;
  location: string;
  editingSoftware: string[];
  suspiciousActivity: boolean;
}

export interface DocumentContentAnalysis {
  section: string;
  status: string;
  details: string;
}

export interface DocumentKeyFindings {
  type: string,
  title: string,
  description: string,
  severity: string
}

export type MalaysiaState = "Johor" | "Kedah" | "Kelantan" | "Melaka" | "Negeri Sembilan" | "Pahang" | "Perak" | "Perlis" | "Pulau Pinang" | "Sabah" | "Sarawak" | "Selangor" | "Terengganu" | "Kuala Lumpur" | "Labuan" | "Putrajaya";
  
export interface SpamReviewInterface {
  comment: string,
  state: MalaysiaState | null
  phone: string | null
}
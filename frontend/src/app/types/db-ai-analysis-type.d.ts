// ** From firestore 

export type RiskLevel = 'SAFE' | 'CAUTION' | 'SUSPICIOUS' | 'CRITICAL';
export type LayerStatus = 'PASS' | 'WARNING' | 'CAUTION' | 'CRITICAL' | 'FAIL';
export type RiskLevelColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray';
export interface ATS_HACKING_DETAILS {
  hidden_white_chars?: number;
  micro_font_chars?: number;
} 
export interface User {
  username: string
  email: string
  created_at: string
}
export interface FileHeader {
    id: string
    user_id: string
    user: User
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
    created_at: string
    flagged?: boolean | null
    expertReview?: boolean | null 
    encryptedKey?: string | null
    iv?: string | null
}

export interface DashboardHeader {
  overall_score: number;
  risk_level: RiskLevel;
  risk_level_color: RiskLevelColor;
  verdict_title: string;
  ai_executive_summary: string;
  grounding_search_reference: string;
  next_step_recommendation: string;
  doc_type: string;
  sources?: string []
}

export interface LayerResult {
  layer_id: string;
  layer_title: string;
  status: LayerStatus;
  status_color?: RiskLevelColor; // Optional as seen in L3
  icon?: string;         // Optional as seen in L3
  score: number;
  ai_analysis: string;
  technical_proofs: string[];
  has_visual_evidence?: boolean;
  evidence_image_url?: string[]; //! Make it as a array
  ATS_hacking?:string;
  ats_hacking_details?: ATS_HACKING_DETAILS;
}

export interface I18N_content {
  en: DocumentAnalysisResult
  ms:DocumentAnalysisResult
}

export interface DocumentAnalysisResult {
  ui_render_mode: string;
  document_id: string;
  processed_at: string; // ISO Date string
  dashboard_header: DashboardHeader;
  layer_results: LayerResult[];
}

export interface DocumentAnalysisOverallResult {
  analysis_content: DocumentAnalysisOverallResult
  created_at: string
  documentId: string
  raw_analysis_id: string
  doc_type: string
}

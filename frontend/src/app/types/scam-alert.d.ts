type ThreatCategory = "Phishing" | "Impersonation" | "Fake Authority" | "Fraud" | "Identity Theft";
type DocumentType = "Invoice" | "Offer Letter" | "Government Notice" | "Bank Statement" | "Contract";
type RiskLevel = "CRITICAL" | "HIGH" | "CAUTION" | "LOW";

interface Comment {
  id: string;
  user: string;
  avatar: string;
  text: string;
  date: string;
  helpful: number;
}

interface ScamAlert {
  id: string;
  documentType: DocumentType;
  threatCategory: ThreatCategory;
  riskLevel: RiskLevel;
  aiConfidence: number;
  reportCount: number;
  firstFlagged: string;
  lastSeen: string;
  state: string;
  title: string;
  redactedPreview: string;
  scamIndicators: string[];
  comments: Comment[];
  verified: boolean;
  riskLevel:RiskLevel
}

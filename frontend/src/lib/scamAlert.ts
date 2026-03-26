export const RISK_CONFIG: Record<RiskLevel, { bg: string; text: string; border: string; bar: string }> = {
    CRITICAL: { 
        bg: "bg-red-50 dark:bg-red-900/20", 
        text: "text-red-600 dark:text-red-400", 
        border: "border-red-200 dark:border-red-800/50", 
        bar: "bg-red-500 dark:bg-red-600" 
    },
    HIGH: { 
        bg: "bg-orange-50 dark:bg-orange-900/20", 
        text: "text-orange-600 dark:text-orange-400", 
        border: "border-orange-200 dark:border-orange-800/50", 
        bar: "bg-orange-500 dark:bg-orange-600" 
    },
    CAUTION: { 
        bg: "bg-yellow-50 dark:bg-yellow-900/20", 
        text: "text-yellow-700 dark:text-yellow-400", 
        border: "border-yellow-200 dark:border-yellow-800/50", 
        bar: "bg-yellow-500 dark:bg-yellow-600" 
    },
    LOW: { 
        bg: "bg-green-50 dark:bg-green-900/20", 
        text: "text-green-700 dark:text-green-400", 
        border: "border-green-200 dark:border-green-800/50", 
        bar: "bg-green-500 dark:bg-green-600" 
    },
};
export const THREAT_ICONS: Record<ThreatCategory, string> = {
    "Phishing": "🎣",
    "Impersonation": "🎭",
    "Fake Authority": "🏛️",
    "Fraud": "💸",
    "Identity Theft": "🪪",
};

export const DOC_ICONS: Record<DocumentType, string> = {
    "Invoice": "🧾",
    "Offer Letter": "📋",
    "Government Notice": "🏛️",
    "Bank Statement": "🏦",
    "Contract": "📝",
};

export const selectClass =
    "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-gray-700 cursor-pointer";


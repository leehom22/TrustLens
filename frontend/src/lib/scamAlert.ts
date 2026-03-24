export const RISK_CONFIG: Record<RiskLevel, { bg: string; text: string; border: string; bar: string }> = {
    CRITICAL: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", bar: "bg-red-500" },
    HIGH: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", bar: "bg-orange-500" },
    CAUTION: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", bar: "bg-yellow-500" },
    LOW: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", bar: "bg-green-500" },
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

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_ALERTS: ScamAlert[] = [
  {
    id: "1",
    documentType: "Government Notice",
    threatCategory: "Fake Authority",
    riskLevel: "CRITICAL",
    aiConfidence: 97,
    reportCount: 142,
    firstFlagged: "Mar 10, 2026",
    lastSeen: "Mar 22, 2026",
    state: "Kuala Lumpur",
    title: "Fake LHDN Tax Penalty Notice",
    redactedPreview:
      "NOTIS PENALTI CUKAI — Kepada: [NAMA DISUNTING], No. Rujukan: LHDN/KL/2026/*****, Anda dikehendaki membayar penalti sebanyak RM 4,200 dalam masa 24 jam atau akaun anda akan dibekukan. Hubungi segera: 011-XXXX-XXXX.",
    scamIndicators: ["Urgent 24-hour deadline", "Unofficial phone number", "Threatening language", "No official letterhead seal"],
    comments: [
      {
        id: "c1",
        user: "Ahmad R.",
        avatar: "AR",
        text: "Received this exact document via WhatsApp. The logo looks off and the reference number format doesn't match real LHDN notices.",
        date: "Mar 21, 2026",
        helpful: 34,
      },
      {
        id: "c2",
        user: "Priya S.",
        avatar: "PS",
        text: "My colleague almost paid! Real LHDN never contacts via WhatsApp for penalties. Stay safe everyone.",
        date: "Mar 20, 2026",
        helpful: 29,
      },
    ],
    verified: true,
  },
  {
    id: "2",
    documentType: "Offer Letter",
    threatCategory: "Impersonation",
    riskLevel: "HIGH",
    aiConfidence: 89,
    reportCount: 87,
    firstFlagged: "Mar 5, 2026",
    lastSeen: "Mar 21, 2026",
    state: "Selangor",
    title: "Fake Petronas Job Offer Letter",
    redactedPreview:
      "SURAT TAWARAN KERJA — Syarikat: Petronas Carigali Sdn Bhd (TIDAK DISAHKAN), Kepada: [NAMA DISUNTING], Jawatan: Senior Executive, Gaji: RM 8,500/bulan. Sila bayar yuran pemprosesan RM 350 untuk mengesahkan penerimaan tawaran.",
    scamIndicators: ["Processing fee requested", "Unofficial email domain", "Incorrect company registration", "Mismatched letterhead fonts"],
    comments: [
      {
        id: "c3",
        user: "Wei Liang",
        avatar: "WL",
        text: "The Petronas logo used here is outdated — they changed it in 2024. Also legitimate companies never ask for processing fees.",
        date: "Mar 18, 2026",
        helpful: 41,
      },
    ],
    verified: true,
  },
  {
    id: "3",
    documentType: "Bank Statement",
    threatCategory: "Phishing",
    riskLevel: "CRITICAL",
    aiConfidence: 94,
    reportCount: 203,
    firstFlagged: "Feb 28, 2026",
    lastSeen: "Mar 23, 2026",
    state: "Penang",
    title: "Maybank Account Suspension Phishing",
    redactedPreview:
      "AKAUN ANDA TELAH DIGANTUNG — No. Akaun: ****-****-[DISUNTING], Aktiviti mencurigakan dikesan. Klik pautan untuk mengesahkan identiti anda dalam 12 jam: http://maybank-secure-[DOMAIN DISUNTING].com",
    scamIndicators: ["Suspicious external URL", "12-hour urgency tactic", "No branch or officer name", "Generic salutation"],
    comments: [
      {
        id: "c4",
        user: "Nurul H.",
        avatar: "NH",
        text: "This is circulating widely in Penang groups. Maybank confirmed to me that they do NOT send account suspension notices via PDF attachments.",
        date: "Mar 22, 2026",
        helpful: 67,
      },
      {
        id: "c5",
        user: "Jason T.",
        avatar: "JT",
        text: "The URL is the biggest giveaway. Maybank's real domain ends in .com.my not .com",
        date: "Mar 19, 2026",
        helpful: 53,
      },
    ],
    verified: true,
  },
  {
    id: "4",
    documentType: "Invoice",
    threatCategory: "Fraud",
    riskLevel: "CAUTION",
    aiConfidence: 72,
    reportCount: 31,
    firstFlagged: "Mar 15, 2026",
    lastSeen: "Mar 20, 2026",
    state: "Johor",
    title: "Suspicious Contractor Invoice — SST Overcharge",
    redactedPreview:
      "INVOIS — Dari: [SYARIKAT DISUNTING] Sdn Bhd (SSM: TIDAK DAPAT DISAHKAN), Kepada: [NAMA DISUNTING], Perkhidmatan: Pemasangan Solar Panel, Jumlah: RM 12,400 + SST 8% (tidak terpakai untuk kategori ini).",
    scamIndicators: ["Incorrect SST rate applied", "Unverifiable SSM registration", "No physical business address", "Pressure to pay within 24h"],
    comments: [],
    verified: false,
  },
  {
    id: "5",
    documentType: "Government Notice",
    threatCategory: "Identity Theft",
    riskLevel: "HIGH",
    aiConfidence: 88,
    reportCount: 59,
    firstFlagged: "Mar 1, 2026",
    lastSeen: "Mar 18, 2026",
    state: "Sabah",
    title: "Fake JPJ Summons — Identity Verification Scam",
    redactedPreview:
      "NOTIS SAMAN JPJ — Kepada Pemilik Kenderaan: [DISUNTING], No. Plat: [DISUNTING], Untuk membatal saman RM 1,000, sila kemukakan salinan MyKad dan maklumat bank anda melalui pautan berikut dalam 48 jam.",
    scamIndicators: ["Requests MyKad copy", "Requests banking info", "Unofficial JPJ domain", "Mismatched summons format"],
    comments: [
      {
        id: "c6",
        user: "Encik Razali",
        avatar: "ER",
        text: "JPJ never asks for IC copy or bank details to cancel summons. You can verify summons only at myeg.com.my or official JPJ counters.",
        date: "Mar 15, 2026",
        helpful: 48,
      },
    ],
    verified: true,
  },
  {
    id: "6",
    documentType: "Contract",
    threatCategory: "Fraud",
    riskLevel: "CAUTION",
    aiConfidence: 68,
    reportCount: 19,
    firstFlagged: "Mar 18, 2026",
    lastSeen: "Mar 22, 2026",
    state: "Kuala Lumpur",
    title: "Dubious Investment Contract — Unlicensed Scheme",
    redactedPreview:
      "PERJANJIAN PELABURAN — [SYARIKAT DISUNTING] menjamin pulangan 30% dalam 60 hari. Pelabur: [NAMA DISUNTING]. Amaun: RM [DISUNTING]. Nota: Syarikat ini TIDAK berdaftar dengan SC Malaysia.",
    scamIndicators: ["Guaranteed returns promised", "Not registered with SC Malaysia", "No risk disclosure", "Pressure tactics in contract language"],
    comments: [],
    verified: false,
  },
];
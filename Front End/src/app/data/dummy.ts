export const metadata = {
    fileName: "Business_Contract_Final.pdf",
    fileSize: "2.4 MB",
    createdDate: "December 15, 2025",
    modifiedDate: "January 10, 2026",
    author: "John Doe",
    lastModifiedBy: "Unknown User",
    totalEdits: 7,
    ipAddress: "192.168.1.142",
    location: "San Francisco, CA, USA",
    editingSoftware: ["Adobe Photoshop CC 2024", "Microsoft Word 2021", "Canva Pro"],
    suspiciousActivity: true
  };

export const findings = [
    {
      type: "warning",
      title: "Multiple Editing Software Detected",
      description: "Document shows traces of editing from Adobe Photoshop, MS Word, and Canva. This is unusual for authentic documents.",
      severity: "medium"
    },
    {
      type: "warning",
      title: "Metadata Inconsistencies",
      description: "Creation date and first modification date don't match. Last modifier identity could not be verified.",
      severity: "medium"
    },
    {
      type: "alert",
      title: "Suspicious Content Detected",
      description: "Section 4.2 contains unusual clauses commonly found in fraudulent contracts. Hidden text layers detected.",
      severity: "high"
    },
    {
      type: "info",
      title: "Digital Signature Missing",
      description: "No valid digital signatures found. Document authenticity cannot be cryptographically verified.",
      severity: "low"
    }
  ];

export const contentAnalysis = [
    {
      section: "Section 1: Introduction",
      status: "safe",
      details: "Standard contract introduction with no suspicious terms detected."
    },
    {
      section: "Section 2: Payment Terms",
      status: "safe",
      details: "Payment terms are clear and follow standard business practices."
    },
    {
      section: "Section 3: Delivery Schedule",
      status: "warning",
      details: "Delivery terms are vague and may lead to disputes. Consider clarification."
    },
    {
      section: "Section 4.2: Liability Clause",
      status: "danger",
      details: "⚠️ CRITICAL: Contains one-sided liability terms heavily favoring the other party. Unusual indemnification clause that may waive your legal rights."
    },
    {
      section: "Section 5: Termination",
      status: "warning",
      details: "Early termination penalties are unusually high (250% of contract value)."
    },
    {
      section: "Section 6: Dispute Resolution",
      status: "danger",
      details: "⚠️ Arbitration clause specifies jurisdiction in foreign country with unfavorable laws."
    }
  ];

  
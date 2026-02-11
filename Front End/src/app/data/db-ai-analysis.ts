export const ai_analysis_format = [
    {
        "ui_render_mode": "report_view",
        "document_id": "inv_2026_999_CRIT",
        "processed_at": "2026-02-09T14:20:00Z",
        "status":"Pending",
        "dashboard_header": {
            "overall_score": 12,
            "risk_level": "CRITICAL",
            "risk_level_color": "#EF4444",
            "verdict_title": "Sophisticated Forgery Detected",
            "ai_executive_summary": "This document has failed every security check. It was created in an image editor, contains visual 'ghosting' on price fields, uses aggressive scam language, and the math is intentionally incorrect to hide a $500 surcharge.",
            "grounding_search_reference": "Vendor 'Global Parts Corp' uses a domain (global-parts-verify.com) registered only 48 hours ago.",
            "next_step_recommendation": "Block this sender immediately and alert your IT security team of a targeted BEC attempt."
        },
        "layer_results": [
            {
                "layer_id": "L1",
                "layer_title": "Metadata & Source",
                "status": "CRITICAL",
                "score": 10,
                "ai_analysis": "Metadata indicates the file was modified by 'Adobe Photoshop' after being exported from a PDF generator.",
                "technical_proofs": ["Source: Adobe Photoshop 2025", "Editing History: 3 separate save cycles detected"]
            },
            {
                "layer_id": "L2",
                "layer_title": "Visual Manipulation",
                "status": "FAIL",
                "score": 5,
                "has_visual_evidence": true,
                "evidence_image_url": "https://static-cse.canva.com/blob/2449454/1237w-QlIJGIW-Mjg.jpg",
                "ai_analysis": "Error Level Analysis shows high-frequency noise around the 'Total Amount' text, confirming it was digitally inserted.",
                "technical_proofs": ["ELA Variance: >85% in text blocks", "Cloning detected in background texture"]
            },
            {
                "layer_id": "L3",
                "layer_title": "Content Semantics",
                "status": "WARNING",
                "score": 30,
                "icon": "alert-octagon",
                "ai_analysis": "The document uses high-pressure legal threats ('Legal action within 24 hours') which is highly irregular for this vendor.",
                "technical_proofs": ["Sentiment: Aggressive/Urgent", "Entity mismatch: Bank name does not match vendor HQ"]
            },
            {
                "layer_id": "L4",
                "layer_title": "Logical Consistency",
                "status": "FAIL",
                "score": 15,
                "ai_analysis": "The line items sum to $1,500, but the Total Due is listed as $2,000 without explanation.",
                "technical_proofs": ["Math Error: 1000 + 500 != 2000", "Tax Rate: Applied at 0% incorrectly"]
            }
        ]
    },

    {
        "ui_render_mode": "report_view",
        "document_id": "inv_2026_442_WARN",
        "processed_at": "2026-02-09T14:25:00Z",
        "dashboard_header": {
            "overall_score": 68,
            "risk_level": "SUSPICIOUS",
            "risk_level_color": "#F97316",
            "verdict_title": "Minor Anomalies Detected",
            "ai_executive_summary": "The document is likely authentic but has been re-saved or scanned, which stripped some metadata. There is a slight mathematical rounding error in the tax calculation.",
            "grounding_search_reference": "Vendor 'Office Depot' identity confirmed via public records.",
            "next_step_recommendation": "Verify the tax amount with the vendor before processing payment."
        },
        "layer_results": [
            {
                "layer_id": "L1",
                "layer_title": "Metadata & Source",
                "status": "CAUTION",
                "score": 60,
                "ai_analysis": "File metadata is missing (typical of a scanned physical document).",
                "technical_proofs": ["Producer: Unknown/Scanner", "XMP Data: Stripped"]
            },
            {
                "layer_id": "L2",
                "layer_title": "Visual Manipulation",
                "status": "PASS",
                "score": 95,
                "has_visual_evidence": false,
                "ai_analysis": "No signs of digital tampering or text overlays detected.",
                "technical_proofs": ["Surface Uniformity: 98%", "Edge Analysis: Clean"]
            },
            {
                "layer_id": "L3",
                "layer_title": "Content Semantics",
                "status": "PASS",
                "score": 90,
                "icon": "check-circle",
                "ai_analysis": "Language and layout match historical invoices from this vendor.",
                "technical_proofs": ["Template Match: 94%", "Keyword Check: Professional"]
            },
            {
                "layer_id": "L4",
                "layer_title": "Logical Consistency",
                "status": "WARNING",
                "score": 55,
                "ai_analysis": "Rounding error: The tax (8.25%) results in $82.50, but the invoice shows $83.00.",
                "technical_proofs": ["Math Variance: $0.50", "Line Item Audit: Passed"]
            }
        ]
    },

    {
        "ui_render_mode": "report_view",
        "document_id": "inv_2026_001_SAFE",
        "processed_at": "2026-02-09T14:30:00Z",
        "dashboard_header": {
            "overall_score": 100,
            "risk_level": "SAFE",
            "risk_level_color": "#22C55E",
            "verdict_title": "Fully Authenticated",
            "ai_executive_summary": "All security layers have verified this document as authentic. Metadata, visual integrity, and logical data are all consistent.",
            "grounding_search_reference": "Vendor and Bank details match the master vendor file exactly.",
            "next_step_recommendation": "Approved for automated payment."
        },
        "layer_results": [
            {
                "layer_id": "L1",
                "layer_title": "Metadata & Source",
                "status": "PASS",
                "score": 100,
                "ai_analysis": "Document was generated by Xero Accounting Software.",
                "technical_proofs": ["Producer: Xero PDF Library", "Digital Signature: Valid"]
            },
            {
                "layer_id": "L2",
                "layer_title": "Visual Manipulation",
                "status": "PASS",
                "score": 100,
                "has_visual_evidence": false,
                "ai_analysis": "No anomalies detected.",
                "technical_proofs": ["Pixel Consistency: Perfect", "Noise Pattern: Uniform"]
            },
            {
                "layer_id": "L3",
                "layer_title": "Content Semantics",
                "status": "PASS",
                "score": 100,
                "icon": "shield-check",
                "ai_analysis": "Standard business language detected.",
                "technical_proofs": ["Risk Keywords: None", "Vendor Alignment: Verified"]
            },
            {
                "layer_id": "L4",
                "layer_title": "Logical Consistency",
                "status": "PASS",
                "score": 100,
                "ai_analysis": "Mathematics are 100% accurate.",
                "technical_proofs": ["Sum Check: Correct", "Tax Audit: Accurate"]
            }
        ]
    }
]
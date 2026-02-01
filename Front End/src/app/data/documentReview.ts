export const documents = [
    {
      id: 1,
      name: 'Invoice_2024_001.pdf',
      submittedBy: 'John Doe',
      submissionDate: '2024-01-30 14:32',
      aiConfidence: 87,
      aiVerdict: 'Potential Forgery' as const,
      riskLevel: 'high' as const,
      flaggedBy: 'AI System',
      aiAnalysis: {
        summary: 'Multiple inconsistencies detected in document structure and content',
        findings: [
          { type: 'Font Mismatch', severity: 'high' as const, detail: 'Multiple font types detected where only one should be present' },
          { type: 'Metadata Anomaly', severity: 'medium' as const, detail: 'Creation date predates company establishment date' },
          { type: 'Digital Signature', severity: 'high' as const, detail: 'Signature appears to be a scanned image rather than authentic digital signature' },
          { type: 'Content Analysis', severity: 'medium' as const, detail: 'Invoice number sequence inconsistent with known patterns' }
        ],
        technicalDetails: {
          fileSize: '2.4 MB',
          created: '2024-01-15 10:23',
          modified: '2024-01-29 16:45',
          software: 'Adobe Photoshop CC 2024',
          pages: 1
        }
      },
      status: 'pending' as const
    },
    {
      id: 2,
      name: 'Contract_Agreement.pdf',
      submittedBy: 'Jane Smith',
      submissionDate: '2024-01-30 11:15',
      aiConfidence: 45,
      aiVerdict: 'Suspicious' as const,
      riskLevel: 'medium' as const,
      flaggedBy: 'User Report',
      aiAnalysis: {
        summary: 'Some unusual patterns detected but not conclusive',
        findings: [
          { type: 'Text Overlay', severity: 'low' as const, detail: 'Some text appears to be overlaid on original content' },
          { type: 'Quality Variance', severity: 'medium' as const, detail: 'Different sections show varying image quality' }
        ],
        technicalDetails: {
          fileSize: '1.8 MB',
          created: '2024-01-20 09:12',
          modified: '2024-01-20 09:15',
          software: 'Microsoft Word 2021',
          pages: 3
        }
      },
      status: 'pending' as const
    },
    {
      id: 3,
      name: 'Receipt_Purchase.jpg',
      submittedBy: 'Mike Johnson',
      submissionDate: '2024-01-29 16:20',
      aiConfidence: 92,
      aiVerdict: 'Potential Forgery' as const,
      riskLevel: 'low' as const,
      flaggedBy: 'Routine Check',
      aiAnalysis: {
        summary: 'Document appears authentic with normal characteristics',
        findings: [
          { type: 'Print Pattern', severity: 'low' as const, detail: 'Natural thermal printer patterns detected' },
          { type: 'Timestamp Analysis', severity: 'low' as const, detail: 'All timestamps are consistent and logical' }
        ],
        technicalDetails: {
          fileSize: '856 KB',
          created: '2024-01-29 14:32',
          modified: '2024-01-29 14:32',
          software: 'iPhone Camera',
          pages: 1
        }
      },
      status: 'reviewed' as const
    }
  ];
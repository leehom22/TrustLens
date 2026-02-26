import jsPDF from 'jspdf';

export interface AnalysisData {
  fileName: string;
  metadata: {
    fileName: string;
    fileSize: string;
    createdDate: string;
    modifiedDate: string;
    author: string;
    lastModifiedBy: string;
    totalEdits: number;
    ipAddress: string;
    location: string;
    editingSoftware: string[];
    suspiciousActivity: boolean;
  };
  findings: Array<{
    type: string;
    title: string;
    description: string;
    severity: string;
  }>;
  contentAnalysis: Array<{
    section: string;
    status: string;
    details: string;
  }>;
  riskLevel: string;
}

export function generateAnalysisPDF(data: AnalysisData): jsPDF {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  // Helper function to add a new page if needed
  const checkPageBreak = (additionalHeight: number) => {
    if (yPosition + additionalHeight > doc.internal.pageSize.height - 20) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Document Forensic Analysis Report', margin, yPosition);
  yPosition += 15;

  // Document Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Analysis Date: ${new Date().toLocaleDateString()}`, margin, yPosition);
  yPosition += 8;
  doc.text(`Document: ${data.fileName}`, margin, yPosition);
  yPosition += 15;

  // Risk Level
  checkPageBreak(20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Risk Assessment', margin, yPosition);
  yPosition += 10;
  
  doc.setFontSize(14);
  const riskColors: { [key: string]: [number, number, number] } = {
    high: [239, 68, 68],
    medium: [251, 191, 36],
    low: [34, 197, 94]
  };
  const riskColor = riskColors[data.riskLevel] || [100, 100, 100];
  doc.setTextColor(...riskColor);
  doc.text(`Risk Level: ${data.riskLevel.toUpperCase()}`, margin, yPosition);
  doc.setTextColor(0, 0, 0);
  yPosition += 15;

  // Metadata Section
  checkPageBreak(80);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Document Metadata', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const metadataItems = [
    ['File Name:', data.metadata.fileName],
    ['File Size:', data.metadata.fileSize],
    ['Created:', data.metadata.createdDate],
    ['Modified:', data.metadata.modifiedDate],
    ['Author:', data.metadata.author],
    ['Last Modified By:', data.metadata.lastModifiedBy],
    ['Total Edits:', data.metadata.totalEdits.toString()],
    ['IP Address:', data.metadata.ipAddress],
    ['Location:', data.metadata.location],
    ['Suspicious Activity:', data.metadata.suspiciousActivity ? 'Yes ⚠' : 'No ✓']
  ];

  metadataItems.forEach(([label, value]) => {
    checkPageBreak(8);
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 45, yPosition);
    yPosition += 7;
  });

  yPosition += 5;

  // Editing Software
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.text('Editing Software Detected:', margin, yPosition);
  yPosition += 7;
  doc.setFont('helvetica', 'normal');
  data.metadata.editingSoftware.forEach((software) => {
    checkPageBreak(7);
    doc.text(`• ${software}`, margin + 5, yPosition);
    yPosition += 7;
  });
  yPosition += 10;

  // Key Findings
  checkPageBreak(20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Findings', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  data.findings.forEach((finding, index) => {
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${finding.title}`, margin, yPosition);
    yPosition += 7;
    
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(finding.description, contentWidth - 5);
    descLines.forEach((line: string) => {
      checkPageBreak(6);
      doc.text(line, margin + 5, yPosition);
      yPosition += 6;
    });
    
    doc.setFont('helvetica', 'italic');
    doc.text(`Severity: ${finding.severity.toUpperCase()}`, margin + 5, yPosition);
    yPosition += 10;
  });

  // Content Analysis
  checkPageBreak(20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Content Analysis', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  data.contentAnalysis.forEach((section) => {
    checkPageBreak(25);
    
    doc.setFont('helvetica', 'bold');
    const statusSymbol = section.status === 'safe' ? '✓' : section.status === 'warning' ? '⚠' : '✗';
    doc.text(`${statusSymbol} ${section.section}`, margin, yPosition);
    yPosition += 7;
    
    doc.setFont('helvetica', 'normal');
    const sectionLines = doc.splitTextToSize(section.details, contentWidth - 5);
    sectionLines.forEach((line: string) => {
      checkPageBreak(6);
      doc.text(line, margin + 5, yPosition);
      yPosition += 6;
    });
    yPosition += 8;
  });

  // Recommendations
  checkPageBreak(40);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Recommendations', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const recommendations = [
    'Have this document reviewed by a qualified legal professional',
    'Request the original, unedited version from the sender',
    'Verify the identity of the document author through alternative channels',
    'Do not proceed with any transaction until concerns are addressed',
    'Consider reporting suspicious activity to relevant authorities'
  ];

  recommendations.forEach((rec, index) => {
    checkPageBreak(7);
    doc.text(`${index + 1}. ${rec}`, margin, yPosition);
    yPosition += 7;
  });

  // Footer on last page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text(
      `TrustLens - Page ${i} of ${totalPages} - Generated on ${new Date().toLocaleString()}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  return doc;
}

export function downloadPDF(doc: jsPDF, fileName: string) {
  doc.save(fileName);
}

export function getPDFBlob(doc: jsPDF): Blob {
  return doc.output('blob');
}
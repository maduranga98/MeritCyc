import jsPDF from 'jspdf';
import { type Cycle } from '../types/cycle';
import { type Evaluation } from '../types/evaluation';

export interface CycleSummaryPDFData {
  cycle: Cycle;
  evaluations: Evaluation[];
  companyName: string;
  companyLogo?: string;
  currency: string;
  departmentBreakdown: { departmentName: string; averageScore: number; employeeCount: number }[];
  tierDistribution: { tierName: string; count: number; percentage: number }[];
  totalBudgetUtilized: number;
  totalBudgetAllocated: number;
}

// Brand color palette (RGB)
const BRAND = {
  primary: [16, 185, 129] as [number, number, number],       // emerald-500
  primaryDark: [4, 120, 87] as [number, number, number],     // emerald-700
  primaryLight: [240, 253, 250] as [number, number, number], // emerald-50
  secondary: [59, 130, 246] as [number, number, number],     // blue-500
  accent: [245, 158, 11] as [number, number, number],        // amber-500
  textDark: [15, 23, 42] as [number, number, number],        // slate-900
  textMuted: [100, 116, 139] as [number, number, number],    // slate-500
  textLight: [51, 65, 85] as [number, number, number],       // slate-700
  border: [226, 232, 240] as [number, number, number],       // slate-200
  surface: [248, 250, 252] as [number, number, number],      // slate-50
};

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const pdfGenerationService = {
  generateCycleSummaryPDF: async (data: CycleSummaryPDFData): Promise<void> => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    let yPosition = margin;

    // Try to load company logo
    let logoBase64: string | null = null;
    if (data.companyLogo) {
      logoBase64 = await loadImageAsBase64(data.companyLogo);
    }

    // PAGE 1: COVER PAGE
    // Branded header bar
    pdf.setFillColor(...BRAND.primary);
    pdf.rect(0, 0, pageWidth, 8, 'F');

    yPosition = margin + 10;

    // Company logo
    if (logoBase64) {
      try {
        pdf.addImage(logoBase64, 'PNG', margin, yPosition, 30, 30);
        yPosition += 35;
      } catch {
        // Fallback to text if logo fails
      }
    }

    // Company name
    pdf.setFontSize(24);
    pdf.setTextColor(...BRAND.primaryDark);
    pdf.text(data.companyName, margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(11);
    pdf.setTextColor(...BRAND.textMuted);
    pdf.text('Increment Cycle Report', margin, yPosition);
    yPosition += 20;

    // Decorative line
    pdf.setDrawColor(...BRAND.primary);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, margin + 60, yPosition);
    yPosition += 15;

    // Cycle information
    pdf.setFontSize(20);
    pdf.setTextColor(...BRAND.textDark);
    pdf.text(data.cycle.name, margin, yPosition);
    yPosition += 12;

    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND.textMuted);
    const startDate = data.cycle.timeline.startDate.toDate().toLocaleDateString();
    const endDate = data.cycle.timeline.endDate.toDate().toLocaleDateString();
    pdf.text(`Period: ${startDate} to ${endDate}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Total Employees: ${data.evaluations.length}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, yPosition);
    yPosition += 20;

    // Footer branding on cover
    pdf.setFontSize(8);
    pdf.setTextColor(...BRAND.textMuted);
    pdf.text(`Powered by MeritCyc`, margin, pageHeight - 15);

    // New page for PAGE 2: EXECUTIVE SUMMARY
    pdf.addPage();
    yPosition = margin;

    // Header bar on inner pages
    pdf.setFillColor(...BRAND.primary);
    pdf.rect(0, 0, pageWidth, 6, 'F');
    yPosition += 10;

    pdf.setFontSize(16);
    pdf.setTextColor(...BRAND.textDark);
    pdf.text('Executive Summary', margin, yPosition);
    yPosition += 12;

    // KPI Cards
    const kpiBoxWidth = (contentWidth - 6) / 3;
    const kpiBoxHeight = 30;

    // KPI 1: Total Employees Evaluated
    pdf.setFillColor(...BRAND.primaryLight);
    pdf.rect(margin, yPosition, kpiBoxWidth, kpiBoxHeight, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND.textMuted);
    pdf.text('Total Employees Evaluated', margin + 5, yPosition + 8);
    pdf.setFontSize(14);
    pdf.setTextColor(...BRAND.primary);
    pdf.text(data.evaluations.length.toString(), margin + 5, yPosition + 22);

    // KPI 2: Budget Utilization
    pdf.setFillColor(239, 246, 255); // blue-50
    pdf.rect(margin + kpiBoxWidth + 3, yPosition, kpiBoxWidth, kpiBoxHeight, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND.textMuted);
    pdf.text('Budget Utilized', margin + kpiBoxWidth + 8, yPosition + 8);
    const budgetPercent = ((data.totalBudgetUtilized / data.totalBudgetAllocated) * 100).toFixed(1);
    pdf.setFontSize(14);
    pdf.setTextColor(...BRAND.secondary);
    pdf.text(`${budgetPercent}%`, margin + kpiBoxWidth + 8, yPosition + 22);

    // KPI 3: Average Increment
    const avgIncrement = (data.evaluations.reduce((sum, e) => sum + (e.incrementPercent || 0), 0) / data.evaluations.length).toFixed(1);
    pdf.setFillColor(255, 247, 237); // orange-50
    pdf.rect(margin + (kpiBoxWidth + 3) * 2, yPosition, kpiBoxWidth, kpiBoxHeight, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND.textMuted);
    pdf.text('Avg Increment %', margin + (kpiBoxWidth + 3) * 2 + 5, yPosition + 8);
    pdf.setFontSize(14);
    pdf.setTextColor(...BRAND.accent);
    pdf.text(`${avgIncrement}%`, margin + (kpiBoxWidth + 3) * 2 + 5, yPosition + 22);

    yPosition += kpiBoxHeight + 12;

    // Summary text
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND.textDark);
    pdf.text(`Summary:`, margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND.textLight);
    const summaryText = `This report details the increment distribution for ${data.cycle.name}. A total of ${data.evaluations.length} employees were evaluated using ${data.cycle.criteria.length} weighted criteria. The cycle resulted in a total budget allocation of ${data.currency} ${data.totalBudgetAllocated.toLocaleString()}, with ${budgetPercent}% utilization.`;
    const splitSummary = pdf.splitTextToSize(summaryText, contentWidth);
    pdf.text(splitSummary, margin, yPosition);
    yPosition += splitSummary.length * 5 + 10;

    // Distribution Overview
    pdf.setFontSize(11);
    pdf.setTextColor(...BRAND.textDark);
    pdf.text('Tier Distribution:', margin, yPosition);
    yPosition += 8;

    data.tierDistribution.forEach((tier) => {
      pdf.setFontSize(9);
      pdf.setTextColor(...BRAND.textMuted);
      pdf.text(`${tier.tierName}: ${tier.count} employees (${tier.percentage.toFixed(1)}%)`, margin + 5, yPosition);
      yPosition += 6;
    });

    // PAGE 3: DEPARTMENT BREAKDOWN
    pdf.addPage();
    yPosition = margin;

    // Header bar
    pdf.setFillColor(...BRAND.primary);
    pdf.rect(0, 0, pageWidth, 6, 'F');
    yPosition += 10;

    pdf.setFontSize(16);
    pdf.setTextColor(...BRAND.textDark);
    pdf.text('Department Breakdown', margin, yPosition);
    yPosition += 12;

    // Department table
    pdf.setFontSize(9);
    const colWidths = [contentWidth * 0.4, contentWidth * 0.3, contentWidth * 0.3];
    const tableStartY = yPosition;
    const rowHeight = 8;

    // Header row
    pdf.setFillColor(...BRAND.surface);
    pdf.rect(margin, tableStartY, contentWidth, rowHeight, 'F');
    pdf.setTextColor(...BRAND.textDark);
    pdf.text('Department', margin + 3, tableStartY + 6);
    pdf.text('Employees', margin + colWidths[0] + 3, tableStartY + 6);
    pdf.text('Avg Score', margin + colWidths[0] + colWidths[1] + 3, tableStartY + 6);

    yPosition = tableStartY + rowHeight;

    // Data rows
    data.departmentBreakdown.forEach((dept, index) => {
      const bgColor = index % 2 === 0 ? 255 : 248;
      pdf.setFillColor(bgColor, bgColor, bgColor);
      pdf.rect(margin, yPosition, contentWidth, rowHeight, 'F');

      pdf.setTextColor(...BRAND.textDark);
      pdf.text(dept.departmentName, margin + 3, yPosition + 6);
      pdf.text(dept.employeeCount.toString(), margin + colWidths[0] + 3, yPosition + 6);
      pdf.text(`${dept.averageScore.toFixed(1)}/100`, margin + colWidths[0] + colWidths[1] + 3, yPosition + 6);

      yPosition += rowHeight;
    });

    // PAGE 4: SCORE DISTRIBUTION
    pdf.addPage();
    yPosition = margin;

    // Header bar
    pdf.setFillColor(...BRAND.primary);
    pdf.rect(0, 0, pageWidth, 6, 'F');
    yPosition += 10;

    pdf.setFontSize(16);
    pdf.setTextColor(...BRAND.textDark);
    pdf.text('Score Distribution Analysis', margin, yPosition);
    yPosition += 12;

    // Calculate score ranges
    const scores = data.evaluations.map(e => e.weightedTotalScore || 0).sort((a, b) => a - b);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const medianScore = scores[Math.floor(scores.length / 2)].toFixed(1);

    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND.textMuted);
    pdf.text(`Min Score: ${minScore.toFixed(1)} | Max Score: ${maxScore.toFixed(1)} | Average: ${avgScore} | Median: ${medianScore}`, margin, yPosition);
    yPosition += 10;

    // Score distribution text
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND.textLight);
    const distText = `Scores are distributed across the evaluation scale with ${data.evaluations.filter(e => (e.weightedTotalScore || 0) >= 80).length} employees scoring 80 or above, ${data.evaluations.filter(e => (e.weightedTotalScore || 0) >= 60 && (e.weightedTotalScore || 0) < 80).length} employees in the 60-80 range, and ${data.evaluations.filter(e => (e.weightedTotalScore || 0) < 60).length} employees below 60.`;
    const splitDist = pdf.splitTextToSize(distText, contentWidth);
    pdf.text(splitDist, margin, yPosition);

    // PAGE 5: EMPLOYEE LIST
    pdf.addPage();
    yPosition = margin;

    // Header bar
    pdf.setFillColor(...BRAND.primary);
    pdf.rect(0, 0, pageWidth, 6, 'F');
    yPosition += 10;

    pdf.setFontSize(16);
    pdf.setTextColor(...BRAND.textDark);
    pdf.text('Detailed Employee List', margin, yPosition);
    yPosition += 12;

    pdf.setFontSize(8);
    const empColWidths = [contentWidth * 0.25, contentWidth * 0.25, contentWidth * 0.2, contentWidth * 0.3];
    const empTableStartY = yPosition;

    // Header
    pdf.setFillColor(...BRAND.surface);
    pdf.rect(margin, empTableStartY, contentWidth, rowHeight, 'F');
    pdf.setTextColor(...BRAND.textDark);
    pdf.text('Employee', margin + 2, empTableStartY + 5);
    pdf.text('Department', margin + empColWidths[0] + 2, empTableStartY + 5);
    pdf.text('Score', margin + empColWidths[0] + empColWidths[1] + 2, empTableStartY + 5);
    pdf.text('Increment %', margin + empColWidths[0] + empColWidths[1] + empColWidths[2] + 2, empTableStartY + 5);

    yPosition = empTableStartY + rowHeight;

    // Data rows (limit to 20 per page)
    const displayEvals = data.evaluations.slice(0, 20);
    displayEvals.forEach((eval_, index) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = margin;
      }

      const bgColor = index % 2 === 0 ? 255 : 248;
      pdf.setFillColor(bgColor, bgColor, bgColor);
      pdf.rect(margin, yPosition, contentWidth, rowHeight - 1, 'F');

      pdf.setTextColor(...BRAND.textDark);
      pdf.setFontSize(7);
      pdf.text(eval_.employeeName.substring(0, 20), margin + 2, yPosition + 4);
      pdf.text((eval_.departmentId || 'N/A').substring(0, 15), margin + empColWidths[0] + 2, yPosition + 4);
      pdf.text((eval_.weightedTotalScore || 0).toFixed(1), margin + empColWidths[0] + empColWidths[1] + 2, yPosition + 4);
      pdf.text(`${(eval_.incrementPercent || 0).toFixed(1)}%`, margin + empColWidths[0] + empColWidths[1] + empColWidths[2] + 2, yPosition + 4);

      yPosition += rowHeight;
    });

    // Add footer to all pages
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(...BRAND.textMuted);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
      pdf.text(`© ${new Date().getFullYear()} ${data.companyName}`, margin, pageHeight - 10);
    }

    // Save the PDF
    pdf.save(`${data.cycle.name.replace(/\s+/g, '_')}_Summary_Report.pdf`);
  },

  downloadPDF: (pdfBlob: Blob, filename: string): void => {
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  },
};

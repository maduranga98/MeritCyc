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

export const pdfGenerationService = {
  generateCycleSummaryPDF: (data: CycleSummaryPDFData): void => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    let yPosition = margin;

    // PAGE 1: COVER PAGE
    // Company branding
    pdf.setFontSize(28);
    pdf.setTextColor(16, 185, 129); // emerald-600
    pdf.text('MeritCyc', margin, yPosition);
    yPosition += 15;

    pdf.setFontSize(11);
    pdf.setTextColor(100, 116, 139); // slate-500
    pdf.text(`${data.companyName} | Increment Cycle Report`, margin, yPosition);
    yPosition += 30;

    // Cycle information
    pdf.setFontSize(20);
    pdf.setTextColor(15, 23, 42); // slate-900
    pdf.text(data.cycle.name, margin, yPosition);
    yPosition += 12;

    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    const startDate = data.cycle.timeline.startDate.toDate().toLocaleDateString();
    const endDate = data.cycle.timeline.endDate.toDate().toLocaleDateString();
    pdf.text(`Period: ${startDate} to ${endDate}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Total Employees: ${data.evaluations.length}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, yPosition);

    // New page for PAGE 2: EXECUTIVE SUMMARY
    pdf.addPage();
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Executive Summary', margin, yPosition);
    yPosition += 12;

    // KPI Cards
    const kpiBoxWidth = (contentWidth - 6) / 3;
    const kpiBoxHeight = 30;

    // KPI 1: Total Employees Evaluated
    pdf.setFillColor(240, 253, 250); // teal-50
    pdf.rect(margin, yPosition, kpiBoxWidth, kpiBoxHeight, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Total Employees Evaluated', margin + 5, yPosition + 8);
    pdf.setFontSize(14);
    pdf.setTextColor(16, 185, 129);
    pdf.text(data.evaluations.length.toString(), margin + 5, yPosition + 22);

    // KPI 2: Budget Utilization
    pdf.setFillColor(240, 245, 250); // blue-50
    pdf.rect(margin + kpiBoxWidth + 3, yPosition, kpiBoxWidth, kpiBoxHeight, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Budget Utilized', margin + kpiBoxWidth + 8, yPosition + 8);
    const budgetPercent = ((data.totalBudgetUtilized / data.totalBudgetAllocated) * 100).toFixed(1);
    pdf.setFontSize(14);
    pdf.setTextColor(59, 130, 246);
    pdf.text(`${budgetPercent}%`, margin + kpiBoxWidth + 8, yPosition + 22);

    // KPI 3: Average Increment
    const avgIncrement = (data.evaluations.reduce((sum, e) => sum + (e.incrementPercent || 0), 0) / data.evaluations.length).toFixed(1);
    pdf.setFillColor(255, 247, 237); // orange-50
    pdf.rect(margin + (kpiBoxWidth + 3) * 2, yPosition, kpiBoxWidth, kpiBoxHeight, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Avg Increment %', margin + (kpiBoxWidth + 3) * 2 + 5, yPosition + 8);
    pdf.setFontSize(14);
    pdf.setTextColor(245, 158, 11);
    pdf.text(`${avgIncrement}%`, margin + (kpiBoxWidth + 3) * 2 + 5, yPosition + 22);

    yPosition += kpiBoxHeight + 12;

    // Summary text
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Summary:`, margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    const summaryText = `This report details the increment distribution for ${data.cycle.name}. A total of ${data.evaluations.length} employees were evaluated using ${data.cycle.criteria.length} weighted criteria. The cycle resulted in a total budget allocation of ${data.currency} ${data.totalBudgetAllocated.toLocaleString()}, with ${budgetPercent}% utilization.`;
    const splitSummary = pdf.splitTextToSize(summaryText, contentWidth);
    pdf.text(splitSummary, margin, yPosition);
    yPosition += splitSummary.length * 5 + 10;

    // Distribution Overview
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Tier Distribution:', margin, yPosition);
    yPosition += 8;

    data.tierDistribution.forEach((tier) => {
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${tier.tierName}: ${tier.count} employees (${tier.percentage.toFixed(1)}%)`, margin + 5, yPosition);
      yPosition += 6;
    });

    // PAGE 3: DEPARTMENT BREAKDOWN
    pdf.addPage();
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Department Breakdown', margin, yPosition);
    yPosition += 12;

    // Department table
    pdf.setFontSize(9);
    const colWidths = [contentWidth * 0.4, contentWidth * 0.3, contentWidth * 0.3];
    const tableStartY = yPosition;
    const rowHeight = 8;

    // Header row
    pdf.setFillColor(241, 245, 249); // slate-100
    pdf.rect(margin, tableStartY, contentWidth, rowHeight, 'F');
    pdf.setTextColor(15, 23, 42);
    pdf.text('Department', margin + 3, tableStartY + 6);
    pdf.text('Employees', margin + colWidths[0] + 3, tableStartY + 6);
    pdf.text('Avg Score', margin + colWidths[0] + colWidths[1] + 3, tableStartY + 6);

    yPosition = tableStartY + rowHeight;

    // Data rows
    data.departmentBreakdown.forEach((dept, index) => {
      const bgColor = index % 2 === 0 ? 255 : 248;
      pdf.setFillColor(bgColor, bgColor, bgColor);
      pdf.rect(margin, yPosition, contentWidth, rowHeight, 'F');

      pdf.setTextColor(15, 23, 42);
      pdf.text(dept.departmentName, margin + 3, yPosition + 6);
      pdf.text(dept.employeeCount.toString(), margin + colWidths[0] + 3, yPosition + 6);
      pdf.text(`${dept.averageScore}/100`, margin + colWidths[0] + colWidths[1] + 3, yPosition + 6);

      yPosition += rowHeight;
    });

    // PAGE 4: SCORE DISTRIBUTION
    pdf.addPage();
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Score Distribution Analysis', margin, yPosition);
    yPosition += 12;

    // Calculate score ranges
    const scores = data.evaluations.map(e => e.weightedTotalScore || 0).sort((a, b) => a - b);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const medianScore = scores[Math.floor(scores.length / 2)].toFixed(1);

    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Min Score: ${minScore.toFixed(1)} | Max Score: ${maxScore.toFixed(1)} | Average: ${avgScore} | Median: ${medianScore}`, margin, yPosition);
    yPosition += 10;

    // Score distribution text
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    const distText = `Scores are distributed across the evaluation scale with ${data.evaluations.filter(e => (e.weightedTotalScore || 0) >= 80).length} employees scoring 80 or above, ${data.evaluations.filter(e => (e.weightedTotalScore || 0) >= 60 && (e.weightedTotalScore || 0) < 80).length} employees in the 60-80 range, and ${data.evaluations.filter(e => (e.weightedTotalScore || 0) < 60).length} employees below 60.`;
    const splitDist = pdf.splitTextToSize(distText, contentWidth);
    pdf.text(splitDist, margin, yPosition);

    // PAGE 5: EMPLOYEE LIST
    pdf.addPage();
    yPosition = margin;

    pdf.setFontSize(16);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Detailed Employee List', margin, yPosition);
    yPosition += 12;

    pdf.setFontSize(8);
    const empColWidths = [contentWidth * 0.25, contentWidth * 0.25, contentWidth * 0.2, contentWidth * 0.3];
    const empTableStartY = yPosition;

    // Header
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, empTableStartY, contentWidth, rowHeight, 'F');
    pdf.setTextColor(15, 23, 42);
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

      pdf.setTextColor(15, 23, 42);
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
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
      pdf.text(`© ${new Date().getFullYear()} MeritCyc`, margin, pageHeight - 10);
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

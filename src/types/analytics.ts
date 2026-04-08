import { Timestamp } from 'firebase/firestore';

export type ReportType =
  | 'cycle_summary'
  | 'annual_summary'
  | 'department_comparison'
  | 'fairness_equity'
  | 'audit_trail';

export type ReportFormat = 'pdf' | 'csv';

export interface GeneratedReport {
  id: string;
  companyId: string;
  reportType: ReportType;
  parameters: Record<string, unknown>;
  format: ReportFormat;
  downloadUrl?: string;
  csvData?: string;
  generatedAt: Timestamp;
  generatedBy: string;
  fileSizeBytes?: number;
}

export interface CompanyKPIs {
  totalEmployees: number;
  activeCycles: number;
  completedCycles: number;
  totalSalaryIncrementsAwarded: number;
  averageIncrementPercent: number;
  fairnessScore: number;
  currency: string;
}

export interface IncrementTrendPoint {
  cycleId: string;
  cycleName: string;
  date: string;
  averageIncrement: number;
  totalEmployees: number;
  totalCost: number;
  budgetUtilization: number;
}

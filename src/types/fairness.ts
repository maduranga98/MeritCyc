import { Timestamp } from 'firebase/firestore';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType =
  | 'high_disparity'
  | 'manager_bias'
  | 'pay_gap'
  | 'criteria_instability'
  | 'low_participation';

export interface DepartmentDisparityMetric {
  departmentId: string;
  departmentName: string;
  averageScore: number;
  averageIncrement: number;
  employeeCount: number;
  topTierPercent: number;
  disparity: number;
}

export interface ManagerConsistencyMetric {
  managerId: string;
  managerName: string;
  averageScore: number;
  scoreVariance: number;
  employeesEvaluated: number;
  outlierCount: number;
  consistencyScore: number;
  individualScores?: { name: string; score: number }[];
}

export interface PayGapMetric {
  metricType: 'department' | 'band' | 'tenure';
  groupA: string;
  groupB: string;
  groupAAverageIncrement: number;
  groupBAverageIncrement: number;
  gapPercent: number;
  isSignificant: boolean;
}

export interface BandDistributionMetric {
  bandId: string;
  bandName: string;
  bandLevel: number;
  employeeCount: number;
  averageScore: number;
  averageIncrement: number;
  topTierCount: number;
}

export interface CriteriaStabilityMetric {
  cyclesWithLockedCriteria: number;
  cyclesWithChanges: number;
  stabilityScore: number;
  lastCriteriaChange?: Timestamp;
}

export interface FairnessAlert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  affectedEntity: string;
  value: number;
}

export interface FairnessReport {
  id: string;
  companyId: string;
  generatedAt: Timestamp;
  generatedBy: string;
  cycleId?: string;
  cycleName?: string;
  overallFairnessScore: number;
  metrics: {
    departmentDisparity: DepartmentDisparityMetric[];
    managerConsistency: ManagerConsistencyMetric[];
    genderPayGap?: PayGapMetric;
    bandDistribution: BandDistributionMetric[];
    criteriaStability: CriteriaStabilityMetric;
  };
  alerts: FairnessAlert[];
  recommendations: string[];
}

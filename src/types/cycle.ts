import { Timestamp } from 'firebase/firestore';

export type CycleStatus = 'draft' | 'active' | 'locked' | 'completed' | 'cancelled';
export type MeasurementType = 'numeric' | 'boolean' | 'rating' | 'percentage';
export type DataSource = 'manager' | 'system' | 'self';

export interface CriteriaItem {
  id: string;
  name: string;
  description?: string;
  weight: number;
  measurementType: MeasurementType;
  dataSource: DataSource;
  minValue?: number;
  maxValue?: number;
  order: number;
}

export interface TierConfig {
  id: string;
  name: string;
  minScore: number;
  maxScore: number;
  incrementMin: number;
  incrementMax: number;
  color: string;
}

export interface CycleScope {
  departmentIds: string[];
  salaryBandIds: string[];
  allEmployees: boolean;
}

export interface CycleBudget {
  type: 'percentage' | 'fixed_pool';
  totalBudget?: number;
  maxPercentage?: number;
  currency: string;
}

export interface CycleTimeline {
  startDate: Timestamp;
  endDate: Timestamp;
  evaluationDeadline: Timestamp;
}

export interface Cycle {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  status: CycleStatus;
  scope: CycleScope;
  budget: CycleBudget;
  criteria: CriteriaItem[];
  tiers: TierConfig[];
  timeline: CycleTimeline;
  lockedAt?: Timestamp;
  lockedBy?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  employeeCount: number;
  totalWeight: number;
}

import { Timestamp } from 'firebase/firestore';

export type DistributionType = 'uniform' | 'normal' | 'top_heavy' | 'bottom_heavy';

export interface TierThresholdOverride {
  tierId: string;
  minScore: number;
  maxScore: number;
  incrementMin: number;
  incrementMax: number;
}

export interface SimulationParameters {
  criteriaWeights: Record<string, number>;
  tierThresholds: TierThresholdOverride[];
  budgetCap?: number;
  assumedDistribution: DistributionType;
}

export interface DistributionPoint {
  tierName: string;
  tierColor: string;
  employeeCount: number;
  projectedCost: number;
  averageIncrement: number;
}

export interface SensitivityPoint {
  threshold: number;
  qualifyingCount: number;
  projectedCost: number;
}

export interface SimulationResults {
  totalProjectedCost: number;
  totalProjectedCostPercent: number;
  employeesByTier: Record<string, number>;
  averageIncrement: number;
  budgetUtilization: number;
  qualifyingEmployees: number;
  distributionData: DistributionPoint[];
  sensitivityData: SensitivityPoint[];
}

export interface Simulation {
  id: string;
  companyId: string;
  cycleId: string;
  name: string;
  description?: string;
  parameters: SimulationParameters;
  results: SimulationResults;
  isApplied: boolean;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export interface WhatIfParams {
  scoreThreshold: number;
  budgetCapMultiplier: number;
  distribution: DistributionType;
}

export interface WhatIfResults {
  qualifyingEmployees: number;
  totalProjectedCost: number;
  averageIncrement: number;
  budgetUtilization: number;
  qualifyingDelta: number;
  costDelta: number;
  avgIncrementDelta: number;
}

export interface BurnRatePoint {
  date: string;
  committed: number;
  projected: number;
}

export interface DepartmentBudget {
  budget: number;
  committed: number;
  projected: number;
}

export interface TierBudget {
  count: number;
  totalAmount: number;
}

export interface BudgetTracking {
  companyId: string;
  cycleId: string;
  totalBudget: number;
  currency: string;
  committed: number;
  projected: number;
  remaining: number;
  utilizationPercent: number;
  byDepartment: Record<string, DepartmentBudget>;
  byTier: Record<string, TierBudget>;
  burnRateData: BurnRatePoint[];
  lastUpdated: number;
}

export interface CareerPathCriterion {
  name: string;
  weight: number;
  threshold: number;
}

export interface CareerPathLevel {
  level: string;
  nextLevel: string;
  criteria: CareerPathCriterion[];
}

export interface CareerPath {
  id: string;
  companyId: string;
  role: string;
  salaryBandId?: string;
  levels: CareerPathLevel[];
}

export interface CriteriaProgress {
  name: string;
  weight: number;
  threshold: number;
  score: number;
  met: boolean;
}

export interface CareerProgressResult {
  userId: string;
  cycleId: string;
  careerPathId: string;
  currentLevel: string;
  nextLevel: string;
  weightedProgress: number;
  eligibleForPromotion: boolean;
  criteriaProgress: CriteriaProgress[];
  updatedAt?: unknown;
}

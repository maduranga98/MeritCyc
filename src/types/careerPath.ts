import { Timestamp } from 'firebase/firestore';

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

// Legacy types — kept for backward compatibility
export interface CareerPathLegacy {
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

// =============================================================================
// New Career Path System Types (v2)
// =============================================================================

export interface Milestone {
  milestoneId: string;
  title: string;
  description: string;
  type: 'cycle_count' | 'score_threshold' | 'tenure_months' | 'manual';
  targetValue: number;
}

export interface CareerLevel {
  levelId: string;
  levelNumber: number;
  title: string;
  salaryBandId: string;
  salaryBandName: string;
  requiredScore: number;
  requiredCycles: number;
  description: string;
  milestones: Milestone[];
}

export interface CareerPath {
  id: string;
  companyId: string;
  name: string;
  description: string;
  levels: CareerLevel[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
}

export interface MilestoneAchievement {
  milestoneId: string;
  achieved: boolean;
  achievedAt?: Timestamp;
}

export interface LevelHistoryEntry {
  levelId: string;
  levelTitle: string;
  salaryBandName: string;
  startedAt: Timestamp;
  promotedAt?: Timestamp;
  cycleId?: string;
}

export interface EmployeeCareerMap {
  userId: string;
  companyId: string;
  careerPathId: string;
  careerPathName: string;
  currentLevelId: string;
  currentLevelNumber: number;
  currentLevelTitle: string;
  currentSalaryBandId: string;
  currentSalaryBandName: string;
  nextLevelId?: string;
  nextLevelTitle?: string;
  nextRequiredScore: number;
  nextRequiredCycles: number;
  completedCyclesAtLevel: number;
  averageScoreLastTwoCycles: number;
  progressPercent: number;
  milestoneAchievements: MilestoneAchievement[];
  levelHistory: LevelHistoryEntry[];
  assignedBy: string;
  assignedAt: Timestamp;
  updatedAt: Timestamp;
}

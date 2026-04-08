import { Timestamp } from 'firebase/firestore';

export type EvaluationStatus =
  | 'not_started'
  | 'draft'
  | 'submitted'
  | 'overridden'
  | 'finalized';

export interface CriteriaScore {
  criteriaId: string;
  criteriaName: string;
  rawScore: number;
  normalizedScore: number;
  weight: number;
  weightedScore: number;
}

export interface Evaluation {
  id: string;
  companyId: string;
  cycleId: string;
  employeeUid: string;
  employeeName: string;
  employeeEmail: string;
  departmentId: string;
  salaryBandId?: string;
  currentSalary?: number;
  managerId: string;
  managerName: string;
  scores: Record<string, CriteriaScore>;
  weightedTotalScore: number;
  assignedTierId?: string;
  assignedTierName?: string;
  incrementPercent?: number;
  incrementAmount?: number;
  status: EvaluationStatus;
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: Timestamp;
  submittedAt?: Timestamp;
  finalizedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

import { type PlanTier } from './company';
export type { PlanTier };

export type GatedFeature =
  | 'hasAuditTrail'
  | 'hasSimulations'
  | 'hasFairnessDashboard'
  | 'hasAdvancedAnalytics'
  | 'hasCareerPaths';

export interface PlanLimits {
  maxEmployees: number | null;
  maxActiveCycles: number | null;
  hasAuditTrail: boolean;
  hasSimulations: boolean;
  hasFairnessDashboard: boolean;
  hasAdvancedAnalytics: boolean;
  hasCareerPaths: boolean;
}

export interface PlanConfig extends PlanLimits {
  id: PlanTier;
  name: string;
  tagline: string;
  pricePerEmployee: number | null;
  trialDays?: number;
  highlights: string[];
  badge?: string;
}

export interface BillingState {
  plan: PlanTier;
  employeeCount: number;
  trialEndsAt?: number;
  isTrialActive: boolean;
  daysLeftInTrial: number | null;
  monthlyTotal: number | null;
  limits: PlanLimits;
}

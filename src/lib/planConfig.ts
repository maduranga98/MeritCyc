import { type PlanConfig, type PlanLimits, type PlanTier, type GatedFeature } from '../types/billing';

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  trial: {
    id: 'trial',
    name: 'Trial',
    tagline: 'Explore all Growth features free for 14 days',
    pricePerEmployee: 0,
    trialDays: 14,
    maxEmployees: 10,
    maxActiveCycles: 1,
    hasAuditTrail: true,
    hasSimulations: true,
    hasFairnessDashboard: true,
    hasAdvancedAnalytics: true,
    hasCareerPaths: true,
    highlights: [
      'All Growth plan features included',
      'Up to 10 employees',
      '1 active cycle',
      '14-day free trial, no card required',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'For small teams starting their performance journey',
    pricePerEmployee: 3,
    maxEmployees: 50,
    maxActiveCycles: 3,
    hasAuditTrail: false,
    hasSimulations: false,
    hasFairnessDashboard: false,
    hasAdvancedAnalytics: false,
    hasCareerPaths: true,
    highlights: [
      '$3 per employee / month',
      'Up to 50 employees',
      'Up to 3 active cycles',
      'Career paths & increment stories',
      'Core analytics',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tagline: 'Full-featured plan for scaling teams',
    pricePerEmployee: 6,
    maxEmployees: 500,
    maxActiveCycles: null,
    hasAuditTrail: true,
    hasSimulations: true,
    hasFairnessDashboard: true,
    hasAdvancedAnalytics: true,
    hasCareerPaths: true,
    badge: 'Most Popular',
    highlights: [
      '$6 per employee / month',
      'Up to 500 employees',
      'Unlimited active cycles',
      'Audit trail & simulations',
      'Fairness dashboard & advanced analytics',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Unlimited scale with dedicated support',
    pricePerEmployee: null,
    maxEmployees: null,
    maxActiveCycles: null,
    hasAuditTrail: true,
    hasSimulations: true,
    hasFairnessDashboard: true,
    hasAdvancedAnalytics: true,
    hasCareerPaths: true,
    highlights: [
      'Custom pricing',
      'Unlimited employees & cycles',
      'All features included',
      'Dedicated support & SLA',
      'Custom integrations',
    ],
  },
};

export function calculateMonthlyBill(plan: PlanTier, employeeCount: number): number | null {
  const config = PLAN_CONFIGS[plan];
  if (config.pricePerEmployee === null) return null;
  return config.pricePerEmployee * employeeCount;
}

export function isFeatureAvailable(plan: PlanTier, feature: GatedFeature): boolean {
  return PLAN_CONFIGS[plan][feature];
}

export function isWithinEmployeeLimit(plan: PlanTier, count: number): boolean {
  const limit = PLAN_CONFIGS[plan].maxEmployees;
  return limit === null || count <= limit;
}

export function isWithinCycleLimit(plan: PlanTier, activeCount: number): boolean {
  const limit = PLAN_CONFIGS[plan].maxActiveCycles;
  return limit === null || activeCount <= limit;
}

export function getPlanLimits(plan: PlanTier): PlanLimits {
  const c = PLAN_CONFIGS[plan];
  return {
    maxEmployees: c.maxEmployees,
    maxActiveCycles: c.maxActiveCycles,
    hasAuditTrail: c.hasAuditTrail,
    hasSimulations: c.hasSimulations,
    hasFairnessDashboard: c.hasFairnessDashboard,
    hasAdvancedAnalytics: c.hasAdvancedAnalytics,
    hasCareerPaths: c.hasCareerPaths,
  };
}

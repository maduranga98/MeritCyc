import type { SimulationResults, DistributionPoint, SensitivityPoint } from '../types/simulation';
import type { Evaluation } from '../types/evaluation';

/**
 * Client-side scenario calculator for real-time what-if analysis
 * Provides instant feedback without server calls during simulation setup
 */

export interface ScenarioInput {
  evaluations: Evaluation[];
  totalBudget: number;
  currency: string;
  tierThresholds: Array<{ minScore: number; maxScore: number; incrementMin: number; incrementMax: number }>;
  budgetCap?: number;
  assumedDistribution: 'uniform' | 'normal' | 'top_heavy' | 'bottom_heavy';
}

/**
 * Calculate score distribution based on assumed distribution type
 */
function getScoreDistribution(assumedDistribution: string, employeeCount: number): number[] {
  const scores: number[] = [];

  switch (assumedDistribution) {
    case 'top_heavy':
      // More employees with high scores
      for (let i = 0; i < employeeCount; i++) {
        const ratio = i / employeeCount;
        // Bias towards higher scores (exponential curve)
        scores.push(30 + Math.pow(ratio, 0.5) * 70);
      }
      break;

    case 'bottom_heavy':
      // More employees with lower scores
      for (let i = 0; i < employeeCount; i++) {
        const ratio = i / employeeCount;
        // Bias towards lower scores (reverse exponential)
        scores.push(30 + Math.pow(1 - ratio, 2) * 70);
      }
      break;

    case 'normal':
      // Normal distribution around 70
      for (let i = 0; i < employeeCount; i++) {
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const score = Math.max(30, Math.min(100, 70 + z * 10));
        scores.push(score);
      }
      break;

    case 'uniform':
    default:
      // Uniform distribution across range
      for (let i = 0; i < employeeCount; i++) {
        scores.push(30 + Math.random() * 70);
      }
      break;
  }

  return scores.sort((a, b) => b - a); // Sort descending
}

/**
 * Calculate increment percentage based on score and tier thresholds
 */
function getIncrementForScore(
  score: number,
  thresholds: Array<{ minScore: number; maxScore: number; incrementMin: number; incrementMax: number }>
): number {
  const tier = thresholds.find(
    (t) => score >= t.minScore && score <= t.maxScore
  );

  if (!tier) {
    // If score doesn't match any tier, use closest tier
    const sorted = [...thresholds].sort((a, b) => {
      const distA = Math.abs(score - (a.minScore + a.maxScore) / 2);
      const distB = Math.abs(score - (b.minScore + b.maxScore) / 2);
      return distA - distB;
    });
    const closestTier = sorted[0];
    return closestTier.incrementMin + (closestTier.incrementMax - closestTier.incrementMin) / 2;
  }

  // Linear interpolation within tier
  const position = (score - tier.minScore) / (tier.maxScore - tier.minScore);
  return tier.incrementMin + (tier.incrementMax - tier.incrementMin) * position;
}

/**
 * Calculate which tier an employee falls into
 */
function getTierForScore(
  score: number,
  thresholds: Array<{ minScore: number; maxScore: number }>
): number {
  return thresholds.findIndex(
    (t) => score >= t.minScore && score <= t.maxScore
  );
}

/**
 * Calculate real-time scenario results without calling Cloud Function
 * Provides immediate feedback for what-if analysis
 */
export function calculateScenario(input: ScenarioInput): SimulationResults {
  const { evaluations, totalBudget, tierThresholds, budgetCap, assumedDistribution } = input;

  // Get score distribution based on assumption
  const scores = getScoreDistribution(assumedDistribution, evaluations.length);

  // Calculate increments and costs
  const employeeIncrements: number[] = [];
  const employeeCosts: number[] = [];
  const employeesByTier: Record<number, number> = {};

  let totalCost = 0;
  let qualifyingCount = 0;

  scores.forEach((score) => {
    const increment = getIncrementForScore(score, tierThresholds);
    const tierIndex = getTierForScore(score, tierThresholds);

    if (tierIndex >= 0) {
      employeesByTier[tierIndex] = (employeesByTier[tierIndex] || 0) + 1;
    }

    if (increment > 0) {
      qualifyingCount++;
    }

    employeeIncrements.push(increment);
    const cost = (totalBudget / evaluations.length) * (increment / 100);
    employeeCosts.push(cost);
    totalCost += cost;
  });

  // Apply budget cap if specified
  let budgetUtilization = (totalCost / totalBudget) * 100;
  let adjustedTotalCost = totalCost;

  if (budgetCap && budgetCap < totalCost) {
    adjustedTotalCost = budgetCap;
    budgetUtilization = (budgetCap / totalBudget) * 100;
  }

  // Calculate distribution data by tier
  const distributionData: DistributionPoint[] = tierThresholds.map((tier, index) => {
    const tierEmployees = employeesByTier[index] || 0;
    const tierScores = scores.filter(
      (s) => s >= tier.minScore && s <= tier.maxScore
    );
    const tierAvgIncrement = tierScores.length > 0 ? employeeIncrements.filter((_, i) => getTierForScore(scores[i], tierThresholds) === index).reduce((a, b) => a + b, 0) / tierScores.length : 0;
    const tierCost = employeeCosts.filter((_, i) => getTierForScore(scores[i], tierThresholds) === index).reduce((a, b) => a + b, 0);

    return {
      tierName: `Tier ${index + 1}`,
      tierColor: getTierColor(index),
      employeeCount: tierEmployees,
      projectedCost: tierCost,
      averageIncrement: tierAvgIncrement,
    };
  });

  // Calculate sensitivity analysis (threshold variations)
  const sensitivityData: SensitivityPoint[] = [];
  for (let threshold = 50; threshold <= 90; threshold += 5) {
    const qualifyingAtThreshold = scores.filter((s) => s >= threshold).length;
    const costAtThreshold = scores
      .filter((s) => s >= threshold)
      .reduce((sum, score) => {
        const increment = getIncrementForScore(score, tierThresholds);
        return sum + (totalBudget / evaluations.length) * (increment / 100);
      }, 0);

    sensitivityData.push({
      threshold,
      qualifyingCount: qualifyingAtThreshold,
      projectedCost: Math.min(budgetCap || costAtThreshold, costAtThreshold),
    });
  }

  return {
    totalProjectedCost: adjustedTotalCost,
    totalProjectedCostPercent: budgetUtilization,
    employeesByTier: Object.fromEntries(
      Object.entries(employeesByTier).map(([k, v]) => [`tier_${k}`, v])
    ),
    averageIncrement: qualifyingCount > 0 ? employeeIncrements.reduce((a, b) => a + b, 0) / employeeIncrements.length : 0,
    budgetUtilization: Math.min(100, budgetUtilization),
    qualifyingEmployees: qualifyingCount,
    distributionData,
    sensitivityData,
  };
}

/**
 * Get color for tier (consistent with design system)
 */
function getTierColor(tierIndex: number): string {
  const colors = [
    '#EF4444', // Red
    '#F97316', // Orange
    '#EAB308', // Yellow
    '#22C55E', // Green
    '#3B82F6', // Blue
  ];
  return colors[tierIndex % colors.length];
}

/**
 * Validate scenario parameters
 */
export function validateScenarioInput(input: ScenarioInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (input.evaluations.length === 0) {
    errors.push('No evaluations available');
  }

  if (input.totalBudget <= 0) {
    errors.push('Budget must be greater than 0');
  }

  if (input.tierThresholds.length === 0) {
    errors.push('At least one tier threshold is required');
  }

  input.tierThresholds.forEach((tier, idx) => {
    if (tier.minScore >= tier.maxScore) {
      errors.push(`Tier ${idx + 1}: Min score must be less than max score`);
    }
    if (tier.incrementMin > tier.incrementMax) {
      errors.push(`Tier ${idx + 1}: Min increment must be less than or equal to max increment`);
    }
  });

  if (input.budgetCap && input.budgetCap <= 0) {
    errors.push('Budget cap must be greater than 0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

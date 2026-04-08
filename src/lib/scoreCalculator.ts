import { type MeasurementType, type TierConfig } from '../types/cycle';
import { type CriteriaScore } from '../types/evaluation';

// Normalize raw score to 0-100 based on measurement type
export function normalizeScore(
  rawScore: number,
  measurementType: MeasurementType,
  minValue?: number,
  maxValue?: number
): number {
  switch (measurementType) {
    case 'boolean':
      return rawScore ? 100 : 0;
    case 'rating':
      // 1-5 rating → 0-100
      return ((rawScore - 1) / 4) * 100;
    case 'percentage':
      return Math.min(100, Math.max(0, rawScore));
    case 'numeric':
      if (minValue === undefined || maxValue === undefined) return rawScore;
      if (maxValue === minValue) return 0;
      return ((rawScore - minValue) / (maxValue - minValue)) * 100;
    default:
      return rawScore;
  }
}

// Calculate weighted total score from all criteria scores
export function calculateWeightedTotal(
  scores: Record<string, CriteriaScore>
): number {
  return Object.values(scores).reduce(
    (total, score) => total + score.weightedScore,
    0
  );
}

// Find which tier a score falls into
export function findTierForScore(
  score: number,
  tiers: TierConfig[]
): TierConfig | null {
  return tiers.find(
    t => score >= t.minScore && score <= t.maxScore
  ) ?? null;
}

// Calculate increment amount from salary and percentage
export function calculateIncrementAmount(
  currentSalary: number,
  incrementPercent: number
): number {
  return (currentSalary * incrementPercent) / 100;
}

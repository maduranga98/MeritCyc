import { type CareerPathLevel, type CareerProgressResult, type CriteriaProgress } from '../types/careerPath';
import { type CriteriaScore } from '../types/evaluation';

export const calculateCareerProgress = (
  userId: string,
  cycleId: string,
  careerPathId: string,
  currentLevel: CareerPathLevel,
  scoresByName: Record<string, CriteriaScore | undefined>
): CareerProgressResult => {
  let weightedTotal = 0;
  let totalWeight = 0;

  const criteriaProgress: CriteriaProgress[] = currentLevel.criteria.map((criterion) => {
    const score = scoresByName[criterion.name]?.normalizedScore ?? 0;
    weightedTotal += score * criterion.weight;
    totalWeight += criterion.weight;

    return {
      name: criterion.name,
      weight: criterion.weight,
      threshold: criterion.threshold,
      score,
      met: score >= criterion.threshold,
    };
  });

  const weightedProgress = totalWeight > 0 ? weightedTotal / totalWeight : 0;
  const eligibleForPromotion = criteriaProgress.every((item) => item.met);

  return {
    userId,
    cycleId,
    careerPathId,
    currentLevel: currentLevel.level,
    nextLevel: currentLevel.nextLevel,
    weightedProgress,
    eligibleForPromotion,
    criteriaProgress,
  };
};

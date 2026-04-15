import type { StoryScoreBreakdown, StoryRecommendation, RecommendationPriority } from '../types/incrementStory';

/**
 * Gap Analysis Utility
 * Calculates improvement recommendations based on performance scores
 */

const GENERIC_SUGGESTIONS: Record<string, Record<string, string>> = {
  excellent: {
    default: 'Maintain your excellent performance and consider mentoring others in this area.',
  },
  good: {
    default: 'Continue to build on your strengths. Minor refinements could elevate your performance.',
  },
  average: {
    default: 'This area shows potential for growth. Focus on understanding key concepts and seeking feedback.',
  },
  needs_improvement: {
    default: 'This is a priority area. Engage with your manager to create a development plan.',
  },
};

const CRITERIA_SUGGESTIONS: Record<string, Record<string, string>> = {
  'Communication': {
    excellent: 'Your communication skills are outstanding. Consider leading team communication initiatives.',
    good: 'Good communication foundation. Practice clarity in complex discussions.',
    average: 'Work on articulating ideas more clearly. Ask for feedback from colleagues.',
    needs_improvement: 'Prioritize communication training. Schedule regular 1-on-1s with your manager.',
  },
  'Technical Skills': {
    excellent: 'Exceptional technical depth. Share knowledge through code reviews and mentoring.',
    good: 'Solid technical foundation. Explore advanced topics or new technologies.',
    average: 'Build depth in core technologies. Take on technical certifications or training.',
    needs_improvement: 'Focus on core technical fundamentals. Pair program with senior engineers.',
  },
  'Teamwork': {
    excellent: 'Exemplary collaboration. Help foster team unity and cross-functional partnerships.',
    good: 'Good team contributor. Expand collaboration beyond your immediate team.',
    average: 'Increase participation in team activities. Build stronger peer relationships.',
    needs_improvement: 'Collaborate more openly. Attend team meetings and contribute to discussions.',
  },
  'Leadership': {
    excellent: 'Strong leadership demonstrated. Take on more complex project ownership.',
    good: 'Developing leadership skills. Volunteer to lead smaller initiatives.',
    average: 'Leadership potential detected. Seek opportunities to lead projects or tasks.',
    needs_improvement: 'Focus on developing foundational leadership skills. Take a leadership course.',
  },
  'Problem Solving': {
    excellent: 'Exceptional analytical skills. Lead strategic problem-solving initiatives.',
    good: 'Good problem-solving approach. Tackle more complex issues.',
    average: 'Strengthen analytical skills. Seek challenging problems to solve.',
    needs_improvement: 'Build problem-solving methodology. Work with mentors on complex issues.',
  },
  'Time Management': {
    excellent: 'Exemplary time management. Help others optimize their productivity.',
    good: 'Effective time management. Refine processes for better efficiency.',
    average: 'Room for improvement in prioritization. Use productivity tools and frameworks.',
    needs_improvement: 'Implement time management systems. Work with your manager on planning.',
  },
};

/**
 * Generate contextual suggestion based on criteria and performance level
 */
export function getSuggestion(criteriaName: string, performance: string): string {
  // Check for criteria-specific suggestions first
  const criteriaKey = Object.keys(CRITERIA_SUGGESTIONS).find(
    (key) => criteriaName.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(criteriaName.toLowerCase())
  );

  if (criteriaKey && CRITERIA_SUGGESTIONS[criteriaKey][performance]) {
    return CRITERIA_SUGGESTIONS[criteriaKey][performance];
  }

  // Fall back to generic suggestions
  return GENERIC_SUGGESTIONS[performance]?.default || GENERIC_SUGGESTIONS.average.default;
}

/**
 * Calculate priority based on performance gap and level
 */
export function calculatePriority(
  currentScore: number,
  targetScore: number,
  performance: string
): RecommendationPriority {
  const gap = targetScore - currentScore;
  const gapPercentage = gap / targetScore;

  // High priority: large gaps in weak areas, or any gap in "needs_improvement"
  if (performance === 'needs_improvement' || gapPercentage >= 0.4) {
    return 'high';
  }

  // Medium priority: moderate gaps in average or good areas
  if (gapPercentage >= 0.2) {
    return 'medium';
  }

  // Low priority: small gaps in good or excellent areas
  return 'low';
}

/**
 * Calculate target score based on performance and career progression
 * Target is where the employee should aim next cycle
 */
export function calculateTargetScore(
  currentScore: number,
  performance: string,
  weight: number
): number {
  const baseMultiplier = {
    excellent: 1.0, // Already at target
    good: 1.1,
    average: 1.25,
    needs_improvement: 1.5,
  };

  const weightMultiplier = Math.min(weight, 1); // Heavier criteria have higher targets
  const multiplier = baseMultiplier[performance as keyof typeof baseMultiplier] || 1.2;
  const target = Math.min(100, Math.round(currentScore * multiplier * (0.8 + weightMultiplier * 0.2)));

  return Math.max(currentScore + 5, target); // At least 5 points improvement
}

/**
 * Generate recommendations from score breakdown
 * Filters low performers and provides actionable suggestions
 */
export function generateRecommendations(
  scoreBreakdown: StoryScoreBreakdown[]
): StoryRecommendation[] {
  return scoreBreakdown
    .filter(
      (score) =>
        // Include below-excellent performers or excellent with lower scores
        score.performance !== 'excellent' ||
        (score.performance === 'excellent' && score.normalizedScore < 80)
    )
    .map((score) => {
      const targetScore = calculateTargetScore(
        score.normalizedScore,
        score.performance,
        score.weight
      );
      const priority = calculatePriority(
        score.normalizedScore,
        targetScore,
        score.performance
      );
      const suggestion = getSuggestion(score.criteriaName, score.performance);

      return {
        criteriaId: score.criteriaId,
        criteriaName: score.criteriaName,
        currentScore: score.normalizedScore,
        targetScore,
        suggestion,
        priority,
      };
    })
    .sort((a, b) => {
      // Sort by priority (high > medium > low) then by gap size
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff =
        (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      if (priorityDiff !== 0) return priorityDiff;

      return (b.targetScore - b.currentScore) - (a.targetScore - a.currentScore);
    });
}

/**
 * Check if recommendations should be shown
 * Returns true if there are actionable improvements needed
 */
export function hasRecommendations(scoreBreakdown: StoryScoreBreakdown[]): boolean {
  return scoreBreakdown.some(
    (score) =>
      score.performance !== 'excellent' ||
      (score.performance === 'excellent' && score.normalizedScore < 80)
  );
}

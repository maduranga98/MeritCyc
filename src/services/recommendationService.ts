import type { StoryScoreBreakdown, StoryRecommendation, RecommendationPriority } from '../types/incrementStory';

/**
 * Gap Analysis Utility
 * Calculates improvement recommendations based on performance scores
 * with personalization from gap size, criteria weight, and historical trends.
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
  'Creativity': {
    excellent: 'Highly creative thinker. Drive innovation initiatives within your team.',
    good: 'Good creative output. Explore design thinking workshops.',
    average: 'Practice brainstorming techniques. Seek diverse perspectives for inspiration.',
    needs_improvement: 'Engage in creative exercises. Collaborate with peers on ideation sessions.',
  },
  'Adaptability': {
    excellent: 'Extremely adaptable. Mentor others through change and uncertainty.',
    good: 'Handles change well. Seek opportunities outside your comfort zone.',
    average: 'Practice flexibility in approach. Reflect on past changes you navigated successfully.',
    needs_improvement: 'Focus on resilience building. Start with small changes to build confidence.',
  },
  'Quality of Work': {
    excellent: 'Exceptional quality standards. Establish best practices for your team.',
    good: 'Good quality output. Implement peer reviews to catch edge cases.',
    average: 'Review your work more thoroughly. Create personal checklists for deliverables.',
    needs_improvement: 'Focus on attention to detail. Ask for feedback on completed work.',
  },
  'Productivity': {
    excellent: 'Outstanding productivity. Share your workflow optimizations with the team.',
    good: 'Solid output. Identify bottlenecks and streamline repetitive tasks.',
    average: 'Track your time on tasks. Use the Eisenhower matrix to prioritize work.',
    needs_improvement: 'Break large tasks into smaller chunks. Eliminate distractions during focus time.',
  },
  'Initiative': {
    excellent: 'Highly proactive. Identify and drive improvements without being asked.',
    good: 'Shows initiative. Look for gaps in processes you can fill.',
    average: 'Volunteer for new assignments. Propose solutions when you spot problems.',
    needs_improvement: 'Start by asking "what can I improve here?" in your daily work.',
  },
  'Customer Focus': {
    excellent: 'Exceptional customer advocacy. Lead customer experience improvements.',
    good: 'Customer-oriented. Gather more direct feedback from end users.',
    average: 'Put yourself in the customer\'s shoes. Map your work to customer outcomes.',
    needs_improvement: 'Study customer pain points. Align your priorities with customer needs.',
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
 * Build a personalized message based on gap size and weight
 */
function buildPersonalizedMessage(
  baseSuggestion: string,
  gap: number,
  weight: number,
  performance: string,
  trend: 'improving' | 'declining' | 'stable' | 'new'
): string {
  const parts: string[] = [baseSuggestion];

  // Add gap context
  if (gap > 0) {
    parts.push(`You need ${gap.toFixed(1)} more points to reach the target.`);
  }

  // Add weight context for high-weight criteria
  if (weight >= 0.25 && performance !== 'excellent') {
    parts.push(`This is a high-impact area (${(weight * 100).toFixed(0)}% weight) — improving here will significantly boost your overall score.`);
  }

  // Add trend context
  if (trend === 'improving') {
    parts.push('Great news: you are improving in this area compared to your previous cycle. Keep the momentum going!');
  } else if (trend === 'declining') {
    parts.push('Note: your score in this area has declined from last cycle. This is a key area to focus on.');
  } else if (trend === 'stable' && performance !== 'excellent') {
    parts.push('Your score has held steady — now is the time to push for a breakthrough.');
  }

  return parts.join(' ');
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
 * Determine trend by comparing current score with previous cycle
 */
function determineTrend(
  currentNormalizedScore: number,
  previousNormalizedScore?: number
): 'improving' | 'declining' | 'stable' | 'new' {
  if (previousNormalizedScore === undefined) return 'new';
  const diff = currentNormalizedScore - previousNormalizedScore;
  if (diff > 3) return 'improving';
  if (diff < -3) return 'declining';
  return 'stable';
}

/**
 * Generate recommendations from score breakdown
 * Filters low performers and provides actionable, personalized suggestions
 */
export function generateRecommendations(
  scoreBreakdown: StoryScoreBreakdown[],
  previousBreakdown?: StoryScoreBreakdown[]
): StoryRecommendation[] {
  // Build a map of previous scores for trend analysis
  const previousScoreMap = new Map<string, number>();
  if (previousBreakdown) {
    previousBreakdown.forEach((pb) => {
      previousScoreMap.set(pb.criteriaId, pb.normalizedScore);
    });
  }

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
      const baseSuggestion = getSuggestion(score.criteriaName, score.performance);
      const trend = determineTrend(
        score.normalizedScore,
        previousScoreMap.get(score.criteriaId)
      );
      const gap = targetScore - score.normalizedScore;
      const suggestion = buildPersonalizedMessage(
        baseSuggestion,
        gap,
        score.weight,
        score.performance,
        trend
      );

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

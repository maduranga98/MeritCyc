import { Timestamp } from 'firebase/firestore';

export type PerformanceLevel =
  | 'excellent'
  | 'good'
  | 'average'
  | 'needs_improvement';

export type RecommendationPriority = 'high' | 'medium' | 'low';

export type MilestoneType =
  | 'cycle_completed'
  | 'tier_achieved'
  | 'band_promoted'
  | 'criteria_mastered';

export type NotificationType =
  | 'evaluation_submitted'
  | 'cycle_locked'
  | 'cycle_completed'
  | 'increment_story_ready'
  | 'account_approved'
  | 'info_requested'
  | 'deadline_reminder'
  | 'general';

export interface StoryScoreBreakdown {
  criteriaId: string;
  criteriaName: string;
  weight: number;
  rawScore: number;
  normalizedScore: number;
  weightedScore: number;
  measurementType: string;
  performance: PerformanceLevel;
}

export interface StoryRecommendation {
  criteriaId: string;
  criteriaName: string;
  currentScore: number;
  targetScore: number;
  suggestion: string;
  priority: RecommendationPriority;
}

export interface IncrementStory {
  cycleId: string;
  cycleName: string;
  companyId: string;
  cycleStartDate: Timestamp;
  cycleEndDate: Timestamp;
  completedAt: Timestamp;
  score: number;
  tierId: string;
  tierName: string;
  tierColor: string;
  incrementPercent: number;
  incrementAmount?: number;
  currency?: string;
  scoreBreakdown: StoryScoreBreakdown[];
  recommendations: StoryRecommendation[];
  previousScore?: number;
  previousTierName?: string;
  isFirstCycle: boolean;
}

export interface CareerMilestone {
  id: string;
  title: string;
  description: string;
  type: MilestoneType;
  achievedAt?: Timestamp;
  isAchieved: boolean;
  iconName: string;
}

export interface CareerHistoryPoint {
  cycleId: string;
  cycleName: string;
  completedAt: Timestamp;
  score: number;
  tierName: string;
  tierColor: string;
  incrementPercent: number;
  bandName: string;
}

export interface CareerMap {
  userId: string;
  companyId: string;
  currentBandId: string;
  currentBandName: string;
  currentBandLevel: number;
  nextBandId?: string;
  nextBandName?: string;
  nextBandLevel?: number;
  milestones: CareerMilestone[];
  history: CareerHistoryPoint[];
  progressPercent: number;
  updatedAt: Timestamp;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: Timestamp;
  companyId: string;
}
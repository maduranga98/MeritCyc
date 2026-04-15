import { differenceInDays } from 'date-fns';

export type DeadlineUrgency = 'overdue' | '1d' | '3d' | '7d' | 'normal';

/**
 * Calculate deadline urgency level
 */
export function getDeadlineUrgency(deadlineDate: Date): DeadlineUrgency {
  const now = new Date();
  const daysRemaining = differenceInDays(deadlineDate, now);

  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining === 0) return '1d';
  if (daysRemaining <= 3) return '3d';
  if (daysRemaining <= 7) return '7d';
  return 'normal';
}

/**
 * Get CSS classes for deadline urgency badge
 */
export function getDeadlineUrgencyClasses(urgency: DeadlineUrgency): {
  container: string;
  badge: string;
  icon: string;
  animate: boolean;
} {
  const classMap = {
    overdue: {
      container: 'bg-red-50 border-red-200',
      badge: 'bg-red-100 text-red-700',
      icon: 'text-red-600',
      animate: true,
    },
    '1d': {
      container: 'bg-red-50 border-red-200',
      badge: 'bg-red-100 text-red-700',
      icon: 'text-red-600',
      animate: true,
    },
    '3d': {
      container: 'bg-red-50 border-red-200',
      badge: 'bg-red-100 text-red-700',
      icon: 'text-red-600',
      animate: true,
    },
    '7d': {
      container: 'bg-amber-50 border-amber-200',
      badge: 'bg-amber-100 text-amber-700',
      icon: 'text-amber-600',
      animate: false,
    },
    normal: {
      container: 'bg-slate-50 border-slate-200',
      badge: 'bg-slate-100 text-slate-700',
      icon: 'text-slate-600',
      animate: false,
    },
  };

  return classMap[urgency];
}

/**
 * Get human-readable deadline label
 */
export function getDeadlineLabel(urgency: DeadlineUrgency): string {
  const labelMap = {
    overdue: 'OVERDUE',
    '1d': '1 DAY LEFT',
    '3d': '3 DAYS LEFT',
    '7d': '7 DAYS LEFT',
    normal: 'ON TRACK',
  };

  return labelMap[urgency];
}

/**
 * Get days remaining from deadline
 */
export function getDaysRemaining(deadlineDate: Date): number {
  return differenceInDays(deadlineDate, new Date());
}

/**
 * Format deadline date for display
 */
export function formatDeadlineDate(deadlineDate: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: deadlineDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  };
  return deadlineDate.toLocaleDateString('en-US', options);
}

/**
 * Check if deadline is critical (less than 3 days)
 */
export function isDeadlineCritical(deadlineDate: Date): boolean {
  return getDaysRemaining(deadlineDate) <= 3;
}

/**
 * Check if evaluation is overdue
 */
export function isOverdue(deadlineDate: Date): boolean {
  return getDaysRemaining(deadlineDate) < 0;
}

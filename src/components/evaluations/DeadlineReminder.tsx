import React from 'react';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  getDeadlineUrgency,
  getDeadlineUrgencyClasses,
  getDeadlineLabel,
  formatDeadlineDate,
  getDaysRemaining,
  isOverdue,
} from '../../utils/deadlineUtils';

interface DeadlineReminderProps {
  deadlineDate: Date;
  variant?: 'card' | 'inline' | 'header';
  showDate?: boolean;
  className?: string;
}

/**
 * Reusable deadline reminder component with urgency indicators
 * Displays deadline with color-coded urgency badges
 */
export const DeadlineReminder: React.FC<DeadlineReminderProps> = ({
  deadlineDate,
  variant = 'inline',
  showDate = true,
  className = '',
}) => {
  const urgency = getDeadlineUrgency(deadlineDate);
  const daysRemaining = getDaysRemaining(deadlineDate);
  const overdue = isOverdue(deadlineDate);
  const { badge, icon, animate } = getDeadlineUrgencyClasses(urgency);
  const label = getDeadlineLabel(urgency);

  if (variant === 'card') {
    return (
      <div className={`rounded-xl border p-4 ${getDeadlineUrgencyClasses(urgency).container}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-1 ${animate ? 'animate-pulse' : ''}`}>
            {overdue ? (
              <AlertCircle className={`w-5 h-5 ${icon}`} />
            ) : daysRemaining <= 3 ? (
              <AlertCircle className={`w-5 h-5 ${icon}`} />
            ) : (
              <Clock className={`w-5 h-5 ${icon}`} />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-bold text-sm ${badge.split(' ')[1]}`}>
                Evaluation Deadline
              </h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge} ${animate ? 'animate-pulse' : ''}`}>
                {label}
              </span>
            </div>
            {showDate && (
              <p className={`text-sm ${badge.split(' ')[1]}`}>
                Due {formatDeadlineDate(deadlineDate)}
                {!overdue && daysRemaining >= 0 && ` (${daysRemaining} days)`}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          Deadline
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-bold px-2 py-1 rounded ${badge} ${animate ? 'animate-pulse' : ''}`}
          >
            {label}
          </span>
          {showDate && <span className="text-sm text-slate-600">{formatDeadlineDate(deadlineDate)}</span>}
        </div>
      </div>
    );
  }

  // default: inline variant
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={animate ? 'animate-pulse' : ''}>
        {overdue ? (
          <AlertCircle className={`w-4 h-4 ${icon}`} />
        ) : daysRemaining <= 3 ? (
          <AlertCircle className={`w-4 h-4 ${icon}`} />
        ) : (
          <Clock className={`w-4 h-4 ${icon}`} />
        )}
      </div>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge} ${animate ? 'animate-pulse' : ''}`}>
        {label}
      </span>
      {showDate && <span className="text-xs text-slate-600">{formatDeadlineDate(deadlineDate)}</span>}
    </div>
  );
};

export default DeadlineReminder;

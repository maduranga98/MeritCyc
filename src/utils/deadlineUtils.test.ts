import { describe, it, expect } from 'vitest';
import { getDeadlineUrgency, isOverdue, getDaysRemaining } from './deadlineUtils';

// Smoke tests for evaluation deadline urgency — drives the 7d/3d/1d/overdue
// badges across the evaluation workflow.
describe('deadlineUtils', () => {
  const daysFromNow = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    // Nudge to noon to avoid same-day boundary flakiness with date-fns.
    d.setHours(12, 0, 0, 0);
    return d;
  };

  describe('getDeadlineUrgency', () => {
    it('flags past deadlines as overdue', () => {
      expect(getDeadlineUrgency(daysFromNow(-2))).toBe('overdue');
    });

    it('escalates as the deadline approaches', () => {
      expect(getDeadlineUrgency(daysFromNow(2))).toBe('3d');
      expect(getDeadlineUrgency(daysFromNow(6))).toBe('7d');
    });

    it('treats far-off deadlines as normal', () => {
      expect(getDeadlineUrgency(daysFromNow(30))).toBe('normal');
    });
  });

  describe('isOverdue', () => {
    it('is true only for past deadlines', () => {
      expect(isOverdue(daysFromNow(-1))).toBe(true);
      expect(isOverdue(daysFromNow(5))).toBe(false);
    });
  });

  describe('getDaysRemaining', () => {
    it('returns a positive count for future deadlines', () => {
      expect(getDaysRemaining(daysFromNow(10))).toBeGreaterThan(0);
    });
  });
});

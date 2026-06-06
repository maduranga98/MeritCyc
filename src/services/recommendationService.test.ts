import { describe, it, expect } from 'vitest';
import { calculatePriority, hasRecommendations } from './recommendationService';

// Smoke tests for the increment-story recommendation engine (employee flow):
// gap-based priority scoring and the "any room to improve" gate.
describe('recommendationService', () => {
  describe('calculatePriority', () => {
    it('flags any gap in a weak area as high priority', () => {
      expect(calculatePriority(60, 65, 'needs_improvement')).toBe('high');
    });

    it('flags large gaps (>=40%) as high priority regardless of performance', () => {
      // gap 50 / target 100 = 50%
      expect(calculatePriority(50, 100, 'good')).toBe('high');
    });

    it('flags moderate gaps (>=20%) as medium priority', () => {
      // gap 25 / target 100 = 25%
      expect(calculatePriority(75, 100, 'good')).toBe('medium');
    });

    it('flags small gaps as low priority', () => {
      // gap 5 / target 100 = 5%
      expect(calculatePriority(95, 100, 'excellent')).toBe('low');
    });
  });

  describe('hasRecommendations', () => {
    it('returns false when there is no score breakdown', () => {
      expect(hasRecommendations([])).toBe(false);
    });
  });
});

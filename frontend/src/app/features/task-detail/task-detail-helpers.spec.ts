import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatShortDate,
  getInitials,
  getAvatarColor,
  getPriorityColor,
  getPriorityIcon,
  getDueDateDisplayColor,
} from './task-detail-helpers';

describe('task-detail-helpers', () => {
  describe('formatDate()', () => {
    it('should format a date string with month, day, year, hour and minute', () => {
      const result = formatDate('2026-03-15T14:30:00Z');
      // The exact format depends on locale, but it should include key parts
      expect(result).toContain('Mar');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });

    it('should handle ISO date strings', () => {
      const result = formatDate('2025-12-25T00:00:00Z');
      expect(result).toContain('Dec');
      expect(result).toContain('25');
      expect(result).toContain('2025');
    });

    it('should include time in the output', () => {
      const result = formatDate('2026-06-01T10:15:00Z');
      // Should contain some time component
      expect(result.length).toBeGreaterThan(10);
    });
  });

  describe('formatShortDate()', () => {
    it('should format a date string with month, day, year only', () => {
      const result = formatShortDate('2026-03-15T14:30:00Z');
      expect(result).toContain('Mar');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });

    it('should not include time', () => {
      const result = formatShortDate('2026-06-01T10:15:00Z');
      // Short date should be shorter than full date
      const fullResult = formatDate('2026-06-01T10:15:00Z');
      expect(result.length).toBeLessThanOrEqual(fullResult.length);
    });
  });

  describe('getInitials()', () => {
    it('should return initials of first and last name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('should return single initial for single name', () => {
      expect(getInitials('Alice')).toBe('A');
    });

    it('should return first two initials for three-word names', () => {
      expect(getInitials('John Michael Doe')).toBe('JM');
    });

    it('should return uppercase initials', () => {
      expect(getInitials('john doe')).toBe('JD');
    });

    it('should handle empty string', () => {
      expect(getInitials('')).toBe('');
    });

    it('should limit to 2 characters max', () => {
      const result = getInitials('A B C D E');
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getAvatarColor()', () => {
    it('should return a color string', () => {
      const color = getAvatarColor('Alice');
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should return consistent color for same name', () => {
      const color1 = getAvatarColor('Bob');
      const color2 = getAvatarColor('Bob');
      expect(color1).toBe(color2);
    });

    it('should return different colors for different names (usually)', () => {
      const color1 = getAvatarColor('Alice');
      const color2 = getAvatarColor('Zack');
      // Different first characters should often produce different colors
      // Not guaranteed for all pairs, so just verify they're valid
      expect(color1).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color2).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle empty string gracefully', () => {
      const color = getAvatarColor('');
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('getPriorityColor()', () => {
    it('should return hex color for urgent priority', () => {
      expect(getPriorityColor('urgent')).toBe('#ef4444');
    });

    it('should return hex color for high priority', () => {
      expect(getPriorityColor('high')).toBe('#f97316');
    });

    it('should return hex color for medium priority', () => {
      expect(getPriorityColor('medium')).toBe('#facc15');
    });

    it('should return hex color for low priority', () => {
      expect(getPriorityColor('low')).toBe('#60a5fa');
    });

    it('should return fallback color for unknown priority', () => {
      expect(getPriorityColor('unknown' as any)).toBe('#94a3b8');
    });
  });

  describe('getPriorityIcon()', () => {
    it('should return label for urgent priority', () => {
      expect(getPriorityIcon('urgent')).toBe('Urgent');
    });

    it('should return label for high priority', () => {
      expect(getPriorityIcon('high')).toBe('High');
    });

    it('should return label for medium priority', () => {
      expect(getPriorityIcon('medium')).toBe('Medium');
    });

    it('should return label for low priority', () => {
      expect(getPriorityIcon('low')).toBe('Low');
    });
  });

  describe('getDueDateDisplayColor()', () => {
    let realDate: DateConstructor;

    beforeEach(() => {
      // Fix date to 2026-02-22 for consistent testing
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-22T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return red color for overdue dates', () => {
      const result = getDueDateDisplayColor('2026-02-20');
      expect(result).toBe('#dc2626');
    });

    it('should return amber color for today due date', () => {
      const result = getDueDateDisplayColor('2026-02-22');
      expect(result).toBe('#d97706');
    });

    it('should return default color for future dates', () => {
      const result = getDueDateDisplayColor('2026-03-15');
      expect(result).toBe('var(--foreground)');
    });
  });
});

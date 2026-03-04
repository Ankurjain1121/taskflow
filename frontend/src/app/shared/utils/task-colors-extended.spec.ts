import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PRIORITY_COLORS_HEX,
  getPriorityColorHex,
  COLUMN_HEADER_COLORS,
  PRIORITY_FLAG_COLORS,
  COLUMN_STATUS_COLORS,
  isOverdue,
  isToday,
  getDueDateColor,
} from './task-colors';

describe('task-colors (extended)', () => {
  describe('PRIORITY_COLORS_HEX', () => {
    it('should have all four priorities', () => {
      expect(PRIORITY_COLORS_HEX).toHaveProperty('urgent');
      expect(PRIORITY_COLORS_HEX).toHaveProperty('high');
      expect(PRIORITY_COLORS_HEX).toHaveProperty('medium');
      expect(PRIORITY_COLORS_HEX).toHaveProperty('low');
    });

    it('each priority should have bg, border, text hex values', () => {
      for (const colors of Object.values(PRIORITY_COLORS_HEX)) {
        expect(colors.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(colors.border).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(colors.text).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe('getPriorityColorHex', () => {
    it('returns correct hex colors for known priorities', () => {
      expect(getPriorityColorHex('urgent')).toEqual(
        PRIORITY_COLORS_HEX['urgent'],
      );
      expect(getPriorityColorHex('high')).toEqual(PRIORITY_COLORS_HEX['high']);
      expect(getPriorityColorHex('medium')).toEqual(
        PRIORITY_COLORS_HEX['medium'],
      );
      expect(getPriorityColorHex('low')).toEqual(PRIORITY_COLORS_HEX['low']);
    });

    it('handles case-insensitive input', () => {
      expect(getPriorityColorHex('URGENT')).toEqual(
        PRIORITY_COLORS_HEX['urgent'],
      );
      expect(getPriorityColorHex('High')).toEqual(PRIORITY_COLORS_HEX['high']);
    });

    it('returns gray fallback for unknown priority', () => {
      const result = getPriorityColorHex('unknown');
      expect(result.bg).toBe('#9ca3af');
      expect(result.border).toBe('#6b7280');
      expect(result.text).toBe('#ffffff');
    });
  });

  describe('COLUMN_HEADER_COLORS', () => {
    it('should be a non-empty array', () => {
      expect(COLUMN_HEADER_COLORS.length).toBeGreaterThan(0);
    });

    it('should contain color strings (hex or var)', () => {
      for (const color of COLUMN_HEADER_COLORS) {
        expect(typeof color).toBe('string');
        expect(color.length).toBeGreaterThan(0);
      }
    });
  });

  describe('PRIORITY_FLAG_COLORS', () => {
    it('should have urgent, high, medium, low', () => {
      expect(PRIORITY_FLAG_COLORS).toHaveProperty('urgent');
      expect(PRIORITY_FLAG_COLORS).toHaveProperty('high');
      expect(PRIORITY_FLAG_COLORS).toHaveProperty('medium');
      expect(PRIORITY_FLAG_COLORS).toHaveProperty('low');
    });

    it('values should be hex colors', () => {
      for (const color of Object.values(PRIORITY_FLAG_COLORS)) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe('COLUMN_STATUS_COLORS', () => {
    it('should have default, done, inProgress, blocked', () => {
      expect(COLUMN_STATUS_COLORS).toHaveProperty('default');
      expect(COLUMN_STATUS_COLORS).toHaveProperty('done');
      expect(COLUMN_STATUS_COLORS).toHaveProperty('inProgress');
      expect(COLUMN_STATUS_COLORS).toHaveProperty('blocked');
    });

    it('each status should have bg and text properties', () => {
      for (const status of Object.values(COLUMN_STATUS_COLORS)) {
        expect(status).toHaveProperty('bg');
        expect(status).toHaveProperty('text');
      }
    });
  });

  describe('isOverdue', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns false for null', () => {
      expect(isOverdue(null)).toBe(false);
    });

    it('returns true for a past date', () => {
      expect(isOverdue('2020-01-01')).toBe(true);
    });

    it('returns false for a far future date', () => {
      expect(isOverdue('2099-12-31')).toBe(false);
    });

    it('returns false for today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T12:00:00'));
      // Today's date: the due date is today, so it should not be overdue
      expect(isOverdue('2026-06-15')).toBe(false);
    });

    it('returns true for yesterday', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T12:00:00'));
      expect(isOverdue('2026-06-14')).toBe(true);
    });
  });

  describe('isToday', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns false for null', () => {
      expect(isToday(null)).toBe(false);
    });

    it('returns true for the current date', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T12:00:00'));
      expect(isToday('2026-06-15')).toBe(true);
    });

    it('returns false for yesterday', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T12:00:00'));
      expect(isToday('2026-06-14')).toBe(false);
    });

    it('returns false for tomorrow', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T12:00:00'));
      expect(isToday('2026-06-16')).toBe(false);
    });
  });

  describe('getDueDateColor', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns muted-foreground and empty chipClass for null', () => {
      const result = getDueDateColor(null);
      expect(result.class).toContain('muted-foreground');
      expect(result.chipClass).toBe('');
    });

    it('returns overdue styling for past dates', () => {
      const result = getDueDateColor('2020-01-01');
      expect(result.chipClass).toBe('chip-overdue');
    });

    it('returns due-soon styling for today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T12:00:00'));
      const result = getDueDateColor('2026-06-15');
      expect(result.chipClass).toBe('chip-due-soon');
    });

    it('returns muted styling for future dates', () => {
      const result = getDueDateColor('2099-12-31');
      expect(result.class).toContain('muted-foreground');
      expect(result.chipClass).toBe('');
    });
  });
});

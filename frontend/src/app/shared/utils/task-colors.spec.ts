import { describe, it, expect } from 'vitest';
import {
  PRIORITY_COLORS,
  PRIORITY_COLORS_HEX,
  PRIORITY_FLAG_COLORS,
  COLUMN_HEADER_COLORS,
  getPriorityColor,
  getPriorityColorHex,
  getPriorityLabel,
  isOverdue,
  isToday,
  getDueDateColor,
} from './task-colors';

describe('task-colors', () => {
  describe('PRIORITY_COLORS', () => {
    it('should have all four priorities', () => {
      expect(PRIORITY_COLORS).toHaveProperty('urgent');
      expect(PRIORITY_COLORS).toHaveProperty('high');
      expect(PRIORITY_COLORS).toHaveProperty('medium');
      expect(PRIORITY_COLORS).toHaveProperty('low');
    });

    it('each priority should have bg, text, border, dot classes', () => {
      for (const [, colors] of Object.entries(PRIORITY_COLORS)) {
        expect(colors).toHaveProperty('bg');
        expect(colors).toHaveProperty('text');
        expect(colors).toHaveProperty('border');
        expect(colors).toHaveProperty('dot');
      }
    });

    it('urgent should use red-toned hex classes', () => {
      expect(PRIORITY_COLORS['urgent'].dot).toContain('#E8445A');
    });

    it('high should use orange-toned hex classes', () => {
      expect(PRIORITY_COLORS['high'].dot).toContain('#F5A623');
    });

    it('medium should use blue-toned hex classes', () => {
      expect(PRIORITY_COLORS['medium'].dot).toContain('#2D5BE3');
    });

    it('low should use green-toned hex classes', () => {
      expect(PRIORITY_COLORS['low'].dot).toContain('#0FA882');
    });
  });

  describe('getPriorityColor', () => {
    it('returns correct colors for known priorities', () => {
      expect(getPriorityColor('urgent')).toBe(PRIORITY_COLORS['urgent']);
      expect(getPriorityColor('high')).toBe(PRIORITY_COLORS['high']);
      expect(getPriorityColor('medium')).toBe(PRIORITY_COLORS['medium']);
      expect(getPriorityColor('low')).toBe(PRIORITY_COLORS['low']);
    });

    it('returns gray fallback for unknown priority', () => {
      const result = getPriorityColor('unknown');
      expect(result.bg).toContain('159,159,159');
      expect(result.text).toContain('#9F9F9F');
      expect(result.border).toContain('159,159,159');
      expect(result.dot).toContain('#9F9F9F');
    });

    it('returns gray fallback for empty string', () => {
      const result = getPriorityColor('');
      expect(result.bg).toContain('159,159,159');
    });
  });

  describe('getPriorityLabel', () => {
    it('capitalizes first letter', () => {
      expect(getPriorityLabel('urgent')).toBe('Urgent');
      expect(getPriorityLabel('high')).toBe('High');
      expect(getPriorityLabel('medium')).toBe('Medium');
      expect(getPriorityLabel('low')).toBe('Low');
    });

    it('returns raw string for unknown single character input', () => {
      expect(getPriorityLabel('a')).toBe('a');
    });

    it('returns raw string for unknown multi-word priority', () => {
      expect(getPriorityLabel('superHigh')).toBe('superHigh');
    });

    it('is case insensitive for known priorities', () => {
      expect(getPriorityLabel('HIGH')).toBe('High');
      expect(getPriorityLabel('LOW')).toBe('Low');
    });
  });

  describe('getPriorityColorHex', () => {
    it('returns correct hex for all priorities', () => {
      expect(getPriorityColorHex('urgent')).toEqual(PRIORITY_COLORS_HEX.urgent);
      expect(getPriorityColorHex('high')).toEqual(PRIORITY_COLORS_HEX.high);
      expect(getPriorityColorHex('medium')).toEqual(PRIORITY_COLORS_HEX.medium);
      expect(getPriorityColorHex('low')).toEqual(PRIORITY_COLORS_HEX.low);
    });

    it('returns gray fallback for unknown priority', () => {
      const result = getPriorityColorHex('invalid');
      expect(result.bg).toBe('#9F9F9F');
      expect(result.border).toBe('#8A8580');
      expect(result.text).toBe('#ffffff');
    });

    it('is case insensitive', () => {
      expect(getPriorityColorHex('LOW')).toEqual(PRIORITY_COLORS_HEX.low);
      expect(getPriorityColorHex('URGENT')).toEqual(
        PRIORITY_COLORS_HEX.urgent,
      );
    });

    it('all hex values are valid hex format', () => {
      for (const priority of ['urgent', 'high', 'medium', 'low'] as const) {
        const hex = PRIORITY_COLORS_HEX[priority];
        expect(hex.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(hex.border).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(hex.text).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe('isOverdue', () => {
    it('returns true for past dates', () => {
      expect(isOverdue('2020-01-01')).toBe(true);
      expect(isOverdue('2000-06-15')).toBe(true);
    });

    it('returns false for future dates', () => {
      expect(isOverdue('2099-12-31')).toBe(false);
      expect(isOverdue('2050-01-01')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isOverdue(null)).toBe(false);
    });

    it('returns false for today', () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      // The function sets today to 00:00, so a date equal to today is NOT overdue
      expect(isOverdue(todayStr)).toBe(false);
    });

    it('returns true for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const str = yesterday.toISOString().split('T')[0];
      expect(isOverdue(str)).toBe(true);
    });
  });

  describe('isToday', () => {
    it('returns true for today', () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      expect(isToday(todayStr)).toBe(true);
    });

    it('returns false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const str = yesterday.toISOString().split('T')[0];
      expect(isToday(str)).toBe(false);
    });

    it('returns false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const str = tomorrow.toISOString().split('T')[0];
      expect(isToday(str)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isToday(null)).toBe(false);
    });
  });

  describe('getDueDateColor', () => {
    it('returns muted style for null', () => {
      const result = getDueDateColor(null);
      expect(result.class).toContain('muted-foreground');
      expect(result.chipClass).toBe('');
    });

    it('returns overdue chip for past dates', () => {
      const result = getDueDateColor('2020-01-01');
      expect(result.chipClass).toBe('chip-overdue');
      expect(result.class).toBe('text-white');
    });

    it('returns due-soon chip for today', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = getDueDateColor(today);
      expect(result.chipClass).toBe('chip-due-soon');
      expect(result.class).toBe('text-white');
    });

    it('returns default style for future dates', () => {
      const result = getDueDateColor('2099-12-31');
      expect(result.class).toContain('muted-foreground');
      expect(result.chipClass).toBe('');
    });
  });

  describe('constants integrity', () => {
    it('PRIORITY_FLAG_COLORS has all 4 priorities', () => {
      expect(Object.keys(PRIORITY_FLAG_COLORS).sort()).toEqual([
        'high',
        'low',
        'medium',
        'urgent',
      ]);
    });

    it('COLUMN_HEADER_COLORS has multiple colors', () => {
      expect(COLUMN_HEADER_COLORS.length).toBeGreaterThanOrEqual(10);
    });

    it('PRIORITY_FLAG_COLORS values are hex', () => {
      for (const color of Object.values(PRIORITY_FLAG_COLORS)) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });
});

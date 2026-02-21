import { describe, it, expect } from 'vitest';
import {
  PRIORITY_COLORS,
  getPriorityColor,
  getPriorityLabel,
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

    it('urgent should use red color classes', () => {
      expect(PRIORITY_COLORS['urgent'].bg).toContain('red');
      expect(PRIORITY_COLORS['urgent'].dot).toContain('red');
    });

    it('high should use orange color classes', () => {
      expect(PRIORITY_COLORS['high'].bg).toContain('orange');
      expect(PRIORITY_COLORS['high'].dot).toContain('orange');
    });

    it('medium should use amber color classes', () => {
      expect(PRIORITY_COLORS['medium'].bg).toContain('amber');
      expect(PRIORITY_COLORS['medium'].dot).toContain('amber');
    });

    it('low should use blue color classes', () => {
      expect(PRIORITY_COLORS['low'].bg).toContain('blue');
      expect(PRIORITY_COLORS['low'].dot).toContain('blue');
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
      expect(result.bg).toBe('bg-gray-400');
      expect(result.text).toBe('text-white');
      expect(result.border).toBe('border-gray-500');
      expect(result.dot).toBe('bg-gray-300');
    });

    it('returns gray fallback for empty string', () => {
      const result = getPriorityColor('');
      expect(result.bg).toBe('bg-gray-400');
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
  });
});

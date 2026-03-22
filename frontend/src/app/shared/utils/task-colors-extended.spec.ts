import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PRIORITY_COLORS_HEX,
  PRIORITY_COLORS_HEX_DARK,
  COLUMN_HEADER_COLORS,
  COLUMN_HEADER_COLORS_DARK,
  PRIORITY_FLAG_COLORS,
  COLUMN_STATUS_COLORS,
  COLOR_BY_MODES,
  LABEL_PRESET_COLORS,
  getPriorityColorHex,
  getColumnHeaderColor,
  resolveCardColor,
  isOverdue,
  isToday,
  getDueDateColor,
  type ColorByMode,
} from './task-colors';

// =============================================================================
// Existing tests (preserved)
// =============================================================================

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
      expect(result.bg).toBe('#9F9F9F');
      expect(result.border).toBe('#8A8580');
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

// =============================================================================
// NEW Phase 4.5: Dark-mode hex, column colors, color-by-X
// =============================================================================

describe('Phase 4.5: Color System Integration', () => {

  // --- PRIORITY_COLORS_HEX_DARK ---
  describe('PRIORITY_COLORS_HEX_DARK', () => {
    it('should have all four priorities', () => {
      expect(PRIORITY_COLORS_HEX_DARK).toHaveProperty('urgent');
      expect(PRIORITY_COLORS_HEX_DARK).toHaveProperty('high');
      expect(PRIORITY_COLORS_HEX_DARK).toHaveProperty('medium');
      expect(PRIORITY_COLORS_HEX_DARK).toHaveProperty('low');
    });

    it('each priority should have valid hex bg, border, text', () => {
      for (const colors of Object.values(PRIORITY_COLORS_HEX_DARK)) {
        expect(colors.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(colors.border).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(colors.text).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('dark bg values should differ from light values', () => {
      expect(PRIORITY_COLORS_HEX_DARK.urgent.bg).not.toBe('#ef4444');
      expect(PRIORITY_COLORS_HEX_DARK.low.bg).not.toBe('#60a5fa');
    });
  });

  // --- getPriorityColorHex with isDark ---
  describe('getPriorityColorHex with isDark parameter', () => {
    it('returns light hex when isDark is false', () => {
      const result = getPriorityColorHex('urgent', false);
      expect(result.bg).toBe('#E8445A');
    });

    it('returns dark hex when isDark is true', () => {
      const result = getPriorityColorHex('urgent', true);
      expect(result).toEqual(PRIORITY_COLORS_HEX_DARK.urgent);
    });

    it('defaults to light mode when isDark is omitted', () => {
      const result = getPriorityColorHex('urgent');
      expect(result.bg).toBe('#E8445A');
    });

    it('returns dark gray fallback for unknown priority in dark mode', () => {
      const result = getPriorityColorHex('invalid', true);
      expect(result.bg).toBe('#8A8580');
      expect(result.border).toBe('#6B6560');
      expect(result.text).toBe('#ffffff');
    });
  });

  // --- COLUMN_HEADER_COLORS_DARK ---
  describe('COLUMN_HEADER_COLORS_DARK', () => {
    it('should have same length as light array', () => {
      expect(COLUMN_HEADER_COLORS_DARK.length).toBe(COLUMN_HEADER_COLORS.length);
    });

    it('first entry should use CSS variable', () => {
      expect(COLUMN_HEADER_COLORS_DARK[0]).toBe('var(--primary)');
    });

    it('all non-variable entries should be valid hex', () => {
      for (const color of COLUMN_HEADER_COLORS_DARK) {
        if (!color.startsWith('var(')) {
          expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
      }
    });
  });

  // --- getColumnHeaderColor ---
  describe('getColumnHeaderColor', () => {
    it('returns light color by default', () => {
      expect(getColumnHeaderColor(0)).toBe('var(--primary)');
    });

    it('returns dark color when isDark is true', () => {
      expect(getColumnHeaderColor(1, true)).toBe(COLUMN_HEADER_COLORS_DARK[1]);
    });

    it('returns light color when isDark is false', () => {
      expect(getColumnHeaderColor(1, false)).toBe(COLUMN_HEADER_COLORS[1]);
    });

    it('wraps around when index exceeds array length', () => {
      const len = COLUMN_HEADER_COLORS.length;
      expect(getColumnHeaderColor(len)).toBe(getColumnHeaderColor(0));
      expect(getColumnHeaderColor(len + 1)).toBe(getColumnHeaderColor(1));
    });

    it('handles negative index with modulo', () => {
      // Implementation should use Math.abs or handle gracefully
      const color = getColumnHeaderColor(-1);
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    });
  });

  // --- COLOR_BY_MODES ---
  describe('COLOR_BY_MODES', () => {
    it('should include all 4 modes', () => {
      expect(COLOR_BY_MODES).toContain('priority');
      expect(COLOR_BY_MODES).toContain('project');
      expect(COLOR_BY_MODES).toContain('assignee');
      expect(COLOR_BY_MODES).toContain('label');
    });

    it('should have exactly 4 entries', () => {
      expect(COLOR_BY_MODES).toHaveLength(4);
    });
  });

  // --- LABEL_PRESET_COLORS ---
  describe('LABEL_PRESET_COLORS', () => {
    it('should have 10 preset colors', () => {
      expect(LABEL_PRESET_COLORS).toHaveLength(10);
    });

    it('all values should be valid hex colors', () => {
      for (const color of LABEL_PRESET_COLORS) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('should not contain near-white or near-black colors', () => {
      for (const color of LABEL_PRESET_COLORS) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const avg = (r + g + b) / 3;
        expect(avg).toBeGreaterThan(30);
        expect(avg).toBeLessThan(240);
      }
    });

    it('should have no duplicates', () => {
      const unique = new Set(LABEL_PRESET_COLORS);
      expect(unique.size).toBe(LABEL_PRESET_COLORS.length);
    });
  });

  // --- resolveCardColor ---
  describe('resolveCardColor', () => {
    const makeTask = (overrides: Record<string, unknown> = {}) => ({
      priority: 'medium',
      labels: [] as Array<{ name: string; color: string | null }>,
      assignees: [] as Array<{ id: string; name: string }>,
      project_color: null as string | null,
      ...overrides,
    });

    // --- priority mode ---
    describe('colorBy = priority', () => {
      it('returns priority flag color for urgent', () => {
        const result = resolveCardColor(makeTask({ priority: 'urgent' }), 'priority');
        expect(result).toBe('#E8445A');
      });

      it('returns priority flag color for low', () => {
        const result = resolveCardColor(makeTask({ priority: 'low' }), 'priority');
        expect(result).toBe('#0FA882');
      });

      it('returns null for empty priority', () => {
        const result = resolveCardColor(makeTask({ priority: '' }), 'priority');
        expect(result).toBeNull();
      });

      it('is case insensitive', () => {
        const result = resolveCardColor(makeTask({ priority: 'HIGH' }), 'priority');
        expect(result).toBe('#F5A623');
      });
    });

    // --- label mode ---
    describe('colorBy = label', () => {
      it('returns first label color alphabetically', () => {
        const task = makeTask({
          labels: [
            { name: 'Zebra', color: '#ff0000' },
            { name: 'Alpha', color: '#00ff00' },
          ],
        });
        expect(resolveCardColor(task, 'label')).toBe('#00ff00');
      });

      it('returns null when task has no labels', () => {
        expect(resolveCardColor(makeTask(), 'label')).toBeNull();
      });

      it('returns null when first label has null color', () => {
        const task = makeTask({
          labels: [{ name: 'Bug', color: null }],
        });
        expect(resolveCardColor(task, 'label')).toBeNull();
      });

      it('sorts case-insensitively', () => {
        const task = makeTask({
          labels: [
            { name: 'beta', color: '#111111' },
            { name: 'Alpha', color: '#222222' },
          ],
        });
        expect(resolveCardColor(task, 'label')).toBe('#222222');
      });

      it('skips labels without color to find first with color', () => {
        const task = makeTask({
          labels: [
            { name: 'Alpha', color: null },
            { name: 'Beta', color: '#333333' },
          ],
        });
        expect(resolveCardColor(task, 'label')).toBe('#333333');
      });
    });

    // --- assignee mode ---
    describe('colorBy = assignee', () => {
      it('returns a deterministic hex color for an assignee', () => {
        const task = makeTask({
          assignees: [{ id: 'user-1', name: 'Alice' }],
        });
        const r1 = resolveCardColor(task, 'assignee');
        const r2 = resolveCardColor(task, 'assignee');
        expect(r1).toBe(r2);
        expect(r1).toMatch(/^#[0-9a-fA-F]{6}$/);
      });

      it('returns null when task has no assignees', () => {
        expect(resolveCardColor(makeTask(), 'assignee')).toBeNull();
      });

      it('uses first assignee when task has multiple', () => {
        const multi = makeTask({
          assignees: [
            { id: 'user-1', name: 'Alice' },
            { id: 'user-2', name: 'Bob' },
          ],
        });
        const single = makeTask({
          assignees: [{ id: 'user-1', name: 'Alice' }],
        });
        expect(resolveCardColor(multi, 'assignee')).toBe(
          resolveCardColor(single, 'assignee'),
        );
      });
    });

    // --- project mode ---
    describe('colorBy = project', () => {
      it('returns project color when available', () => {
        const task = makeTask({ project_color: '#3b82f6' });
        expect(resolveCardColor(task, 'project')).toBe('#3b82f6');
      });

      it('returns null when project has no color', () => {
        expect(resolveCardColor(makeTask(), 'project')).toBeNull();
      });
    });

    // --- unknown mode ---
    describe('colorBy = unknown', () => {
      it('falls back to priority for unknown colorBy value', () => {
        const task = makeTask({ priority: 'high' });
        expect(resolveCardColor(task, 'unknown' as ColorByMode)).toBe(
          resolveCardColor(task, 'priority'),
        );
      });
    });
  });
});

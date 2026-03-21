import { TaskPriority } from '../../core/services/task.service';

// =============================================================================
// Color-by-X types and constants
// =============================================================================

/** Valid modes for the color-by-X feature */
export type ColorByMode = 'priority' | 'project' | 'assignee' | 'label';

export const COLOR_BY_MODES: readonly ColorByMode[] = [
  'priority',
  'project',
  'assignee',
  'label',
] as const;

/** 6 earth-tone preset colors for the label color picker */
export const LABEL_PRESET_COLORS: readonly string[] = [
  '#B81414', // red (urgent)
  '#BF7B54', // burnt orange (high)
  '#D4A853', // warm gold (medium)
  '#9C9561', // olive (low)
  '#9F9F9F', // warm gray (none)
  '#5E8C4A', // sage green (done)
] as const;

// =============================================================================
// Priority colors (CSS custom property based)
// =============================================================================

/**
 * SINGLE SOURCE OF TRUTH for task priority colors
 * Uses CSS custom property references for earth-tone palette
 */
export const PRIORITY_COLORS: Record<
  TaskPriority,
  { bg: string; text: string; border: string; dot: string }
> = {
  urgent: {
    bg: 'bg-[rgba(184,20,20,0.08)] dark:bg-[rgba(212,32,32,0.12)]',
    text: 'text-[#B81414] dark:text-[#D42020]',
    border: 'border-[rgba(184,20,20,0.2)] dark:border-[rgba(212,32,32,0.3)]',
    dot: 'bg-[#B81414]',
  },
  high: {
    bg: 'bg-[rgba(191,123,84,0.08)] dark:bg-[rgba(212,148,94,0.12)]',
    text: 'text-[#BF7B54] dark:text-[#D4945E]',
    border: 'border-[rgba(191,123,84,0.2)] dark:border-[rgba(212,148,94,0.3)]',
    dot: 'bg-[#BF7B54]',
  },
  medium: {
    bg: 'bg-[rgba(212,168,83,0.08)] dark:bg-[rgba(224,188,106,0.12)]',
    text: 'text-[#D4A853] dark:text-[#E0BC6A]',
    border: 'border-[rgba(212,168,83,0.2)] dark:border-[rgba(224,188,106,0.3)]',
    dot: 'bg-[#D4A853]',
  },
  low: {
    bg: 'bg-[rgba(156,149,97,0.08)] dark:bg-[rgba(181,174,120,0.12)]',
    text: 'text-[#9C9561] dark:text-[#B5AE78]',
    border: 'border-[rgba(156,149,97,0.2)] dark:border-[rgba(181,174,120,0.3)]',
    dot: 'bg-[#9C9561]',
  },
};

/**
 * Priority colors with hex values for use in non-Tailwind contexts
 */
export const PRIORITY_COLORS_HEX: Record<
  TaskPriority,
  { bg: string; border: string; text: string }
> = {
  urgent: {
    bg: '#B81414',
    border: '#961010',
    text: '#ffffff',
  },
  high: {
    bg: '#BF7B54',
    border: '#A66843',
    text: '#ffffff',
  },
  medium: {
    bg: '#D4A853',
    border: '#BF9742',
    text: '#3D2414',
  },
  low: {
    bg: '#9C9561',
    border: '#8A844F',
    text: '#ffffff',
  },
};

/**
 * Priority hex colors for dark mode (softer tones on dark backgrounds)
 */
export const PRIORITY_COLORS_HEX_DARK: Record<
  TaskPriority,
  { bg: string; border: string; text: string }
> = {
  urgent: {
    bg: '#D42020',
    border: '#B81414',
    text: '#ffffff',
  },
  high: {
    bg: '#D4945E',
    border: '#BF7B54',
    text: '#ffffff',
  },
  medium: {
    bg: '#E0BC6A',
    border: '#D4A853',
    text: '#3D2414',
  },
  low: {
    bg: '#B5AE78',
    border: '#9C9561',
    text: '#ffffff',
  },
};

/**
 * Get priority hex color values by priority string
 * @param isDark - when true, returns dark-mode-appropriate colors
 */
export function getPriorityColorHex(
  priority: string,
  isDark?: boolean,
): {
  bg: string;
  border: string;
  text: string;
} {
  const normalizedPriority = priority.toLowerCase() as TaskPriority;
  const map = isDark ? PRIORITY_COLORS_HEX_DARK : PRIORITY_COLORS_HEX;
  const fallback = isDark
    ? { bg: '#8A8580', border: '#6B6560', text: '#ffffff' }
    : { bg: '#9F9F9F', border: '#8A8580', text: '#ffffff' };
  return map[normalizedPriority] || fallback;
}

/**
 * Earth-tone colors for column headers
 */
export const COLUMN_HEADER_COLORS: string[] = [
  'var(--primary)', // burnt orange primary
  '#5E8C4A',       // sage green
  '#D4A853',       // warm gold
  '#B81414',       // red
  '#9C9561',       // olive
  '#996F49',       // nougat
  '#7AAF60',       // light sage
  '#E0BC6A',       // light gold
  '#D4945E',       // light burnt orange
  '#8A844F',       // dark olive
  '#A66843',       // dark burnt orange
  '#5A361F',       // dark brown
];

/**
 * Column header colors for dark mode (lighter/brighter for contrast)
 */
export const COLUMN_HEADER_COLORS_DARK: string[] = [
  'var(--primary)', // primary (auto-adapts)
  '#7AAF60',       // sage green light
  '#E0BC6A',       // warm gold light
  '#D42020',       // red light
  '#B5AE78',       // olive light
  '#BF7B54',       // burnt orange
  '#A5D48F',       // bright sage
  '#F0D080',       // bright gold
  '#E8AD70',       // bright burnt orange
  '#C5BD80',       // bright olive
  '#D4945E',       // medium burnt orange
  '#8B5535',       // medium brown
];

/**
 * Get a column header color by index, theme-aware
 * @param index - column index (wraps around)
 * @param isDark - when true, returns dark-mode colors
 */
export function getColumnHeaderColor(index: number, isDark?: boolean): string {
  const colors = isDark ? COLUMN_HEADER_COLORS_DARK : COLUMN_HEADER_COLORS;
  const safeIndex = ((index % colors.length) + colors.length) % colors.length;
  return colors[safeIndex];
}

/** Priority flag hex colors for SVG rendering */
export const PRIORITY_FLAG_COLORS: Record<string, string> = {
  urgent: '#B81414',
  high: '#BF7B54',
  medium: '#D4A853',
  low: '#9C9561',
};

/**
 * Column status indicator colors
 */
export const COLUMN_STATUS_COLORS = {
  default: {
    bg: 'bg-[var(--secondary)]',
    text: 'text-[var(--muted-foreground)]',
  },
  done: {
    bg: 'bg-[var(--status-green-bg)]',
    text: 'text-[var(--status-green-text)]',
  },
  inProgress: {
    bg: 'bg-[var(--status-blue-bg)]',
    text: 'text-[var(--status-blue-text)]',
  },
  blocked: {
    bg: 'bg-[var(--status-red-bg)]',
    text: 'text-[var(--status-red-text)]',
  },
};

/**
 * Get priority color classes by priority value
 */
export function getPriorityColor(priority: string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  const normalizedPriority = priority.toLowerCase() as TaskPriority;
  return (
    PRIORITY_COLORS[normalizedPriority] || {
      bg: 'bg-[rgba(159,159,159,0.08)]',
      text: 'text-[#9F9F9F]',
      border: 'border-[rgba(159,159,159,0.2)]',
      dot: 'bg-[#9F9F9F]',
    }
  );
}

/**
 * Get human-readable priority label
 */
export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return labels[priority.toLowerCase()] || priority;
}

/**
 * Check if a date is overdue
 */
export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

/**
 * Check if a date is today
 */
export function isToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  return (
    due.getDate() === today.getDate() &&
    due.getMonth() === today.getMonth() &&
    due.getFullYear() === today.getFullYear()
  );
}

/**
 * Get due date color classes based on date
 */
export function getDueDateColor(dueDate: string | null): {
  class: string;
  chipClass: string;
} {
  if (!dueDate)
    return { class: 'text-[var(--muted-foreground)]', chipClass: '' };
  if (isOverdue(dueDate))
    return { class: 'text-white', chipClass: 'chip-overdue' };
  if (isToday(dueDate))
    return { class: 'text-white', chipClass: 'chip-due-soon' };
  return { class: 'text-[var(--muted-foreground)]', chipClass: '' };
}

// =============================================================================
// resolveCardColor — SINGLE SOURCE OF TRUTH for card color resolution
// =============================================================================

/** Minimal task shape needed for color resolution */
export interface ColorableTask {
  priority: string;
  labels: Array<{ name: string; color: string | null }>;
  assignees: Array<{ id: string; name: string }>;
  project_color: string | null;
}

/** Context for color resolution (unused for now, extensible) */
export interface ColorByContext {
  isDark?: boolean;
}

/**
 * Deterministic hash of a string to an index in LABEL_PRESET_COLORS
 */
function hashStringToColorIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return ((hash % LABEL_PRESET_COLORS.length) + LABEL_PRESET_COLORS.length) % LABEL_PRESET_COLORS.length;
}

/**
 * Resolve the accent color for a task card based on the active color-by mode.
 *
 * @returns A hex color string for the card's left stripe, or null if no color applies
 */
export function resolveCardColor(
  task: ColorableTask,
  colorBy: ColorByMode,
): string | null {
  switch (colorBy) {
    case 'priority': {
      const p = task.priority.toLowerCase();
      return PRIORITY_FLAG_COLORS[p] ?? null;
    }

    case 'label': {
      if (task.labels.length === 0) return null;
      const sorted = [...task.labels].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
      // Find first label with a color
      const withColor = sorted.find((l) => l.color != null);
      return withColor?.color ?? null;
    }

    case 'assignee': {
      if (task.assignees.length === 0) return null;
      const first = task.assignees[0];
      const idx = hashStringToColorIndex(first.id);
      return LABEL_PRESET_COLORS[idx];
    }

    case 'project': {
      return task.project_color ?? null;
    }

    default: {
      // Unknown mode — fall back to priority
      const fallbackP = task.priority.toLowerCase();
      return PRIORITY_FLAG_COLORS[fallbackP] ?? null;
    }
  }
}

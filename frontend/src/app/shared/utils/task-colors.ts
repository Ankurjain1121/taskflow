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

/** 12 preset colors for the label color picker (accessible, no near-white/black) */
export const LABEL_PRESET_COLORS: readonly string[] = [
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#22c55e', // green
  '#f97316', // orange
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#64748b', // slate
  '#14b8a6', // teal
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
] as const;

// =============================================================================
// Priority colors (Tailwind classes)
// =============================================================================

/**
 * SINGLE SOURCE OF TRUTH for task priority colors
 * Uses Tailwind CSS classes for consistent styling
 */
export const PRIORITY_COLORS: Record<
  TaskPriority,
  { bg: string; text: string; border: string; dot: string }
> = {
  urgent: {
    bg: 'bg-red-50 dark:bg-red-950',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
  high: {
    bg: 'bg-orange-50 dark:bg-orange-950',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
  },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  low: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
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
    bg: '#E8445A',
    border: '#C93545',
    text: '#ffffff',
  },
  high: {
    bg: '#F5A623',
    border: '#D4900E',
    text: '#ffffff',
  },
  medium: {
    bg: '#facc15',
    border: '#eab308',
    text: '#713f12',
  },
  low: {
    bg: '#60a5fa',
    border: '#3b82f6',
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
    bg: '#F0526A',
    border: '#E8445A',
    text: '#ffffff',
  },
  high: {
    bg: '#F7B731',
    border: '#F5A623',
    text: '#ffffff',
  },
  medium: {
    bg: '#fcd34d',
    border: '#fbbf24',
    text: '#422006',
  },
  low: {
    bg: '#93c5fd',
    border: '#60a5fa',
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
    ? { bg: '#6b7280', border: '#4b5563', text: '#ffffff' }
    : { bg: '#9ca3af', border: '#6b7280', text: '#ffffff' };
  return map[normalizedPriority] || fallback;
}

/**
 * Bright colors for column headers (Monday.com style)
 */
export const COLUMN_HEADER_COLORS: string[] = [
  'var(--primary)', // primary
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#0086C0', // monday blue
  '#00C875', // monday green
  '#FDAB3D', // monday orange
  '#E2445C', // monday red
  '#A25DDC', // monday purple
  '#579BFC', // monday sky
  '#FF158A', // monday pink
  '#CAB641', // monday olive
  '#9AADBD', // monday blue-gray
  '#7F5347', // monday brown
  '#175A63', // monday teal-dark
];

/**
 * Column header colors for dark mode (lighter/brighter for contrast)
 */
export const COLUMN_HEADER_COLORS_DARK: string[] = [
  'var(--primary)', // primary (auto-adapts)
  '#60a5fa', // blue-400
  '#4ade80', // green-400
  '#fbbf24', // amber-400
  '#f87171', // red-400
  '#a78bfa', // violet-400
  '#f472b6', // pink-400
  '#2dd4bf', // teal-400
  '#38bdf8', // sky-400
  '#34d399', // emerald-400
  '#fdba74', // orange-300
  '#fb7185', // rose-400
  '#c084fc', // purple-400
  '#7dd3fc', // sky-300
  '#fb923c', // orange-400
  '#d9f99d', // lime-200
  '#bae6fd', // sky-200
  '#a78bfa', // violet-400
  '#2dd4bf', // teal-400
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
  urgent: '#E8445A',
  high: '#F5A623',
  medium: '#facc15',
  low: '#60a5fa',
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
      bg: 'bg-gray-400',
      text: 'text-white',
      border: 'border-gray-500',
      dot: 'bg-gray-300',
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

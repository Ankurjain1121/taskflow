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

/** Trello-style bright label preset colors for the label color picker */
export const LABEL_PRESET_COLORS: readonly string[] = [
  '#E8445A', // red
  '#F5A623', // orange
  '#61BD4F', // green
  '#0079BF', // blue
  '#C377E0', // purple
  '#00C2E0', // sky
  '#FF78CB', // pink
  '#51E898', // lime
  '#344563', // dark navy
  '#B3BAC5', // gray
] as const;

// =============================================================================
// Priority colors — SINGLE SOURCE OF TRUTH
// =============================================================================

/**
 * Base hex values for each priority level.
 * All other priority color maps are derived from this.
 */
const PRIORITY_BASE = {
  urgent: { hex: '#E8445A', darkHex: '#F4707F' },
  high:   { hex: '#F5A623', darkHex: '#F5C060' },
  medium: { hex: '#2D5BE3', darkHex: '#5B82F0' },
  low:    { hex: '#0FA882', darkHex: '#3DC9A5' },
} as const;

/**
 * Tailwind CSS class maps for priority colors (light + dark mode)
 */
export const PRIORITY_COLORS: Record<
  TaskPriority,
  { bg: string; text: string; border: string; dot: string }
> = {
  urgent: {
    bg: `bg-[rgba(232,68,90,0.08)] dark:bg-[rgba(244,112,127,0.12)]`,
    text: `text-[${PRIORITY_BASE.urgent.hex}] dark:text-[${PRIORITY_BASE.urgent.darkHex}]`,
    border: `border-[rgba(232,68,90,0.2)] dark:border-[rgba(244,112,127,0.3)]`,
    dot: `bg-[${PRIORITY_BASE.urgent.hex}]`,
  },
  high: {
    bg: `bg-[rgba(245,166,35,0.08)] dark:bg-[rgba(245,192,96,0.12)]`,
    text: `text-[${PRIORITY_BASE.high.hex}] dark:text-[${PRIORITY_BASE.high.darkHex}]`,
    border: `border-[rgba(245,166,35,0.2)] dark:border-[rgba(245,192,96,0.3)]`,
    dot: `bg-[${PRIORITY_BASE.high.hex}]`,
  },
  medium: {
    bg: `bg-[rgba(45,91,227,0.08)] dark:bg-[rgba(91,130,240,0.12)]`,
    text: `text-[${PRIORITY_BASE.medium.hex}] dark:text-[${PRIORITY_BASE.medium.darkHex}]`,
    border: `border-[rgba(45,91,227,0.2)] dark:border-[rgba(91,130,240,0.3)]`,
    dot: `bg-[${PRIORITY_BASE.medium.hex}]`,
  },
  low: {
    bg: `bg-[rgba(15,168,130,0.08)] dark:bg-[rgba(61,201,165,0.12)]`,
    text: `text-[${PRIORITY_BASE.low.hex}] dark:text-[${PRIORITY_BASE.low.darkHex}]`,
    border: `border-[rgba(15,168,130,0.2)] dark:border-[rgba(61,201,165,0.3)]`,
    dot: `bg-[${PRIORITY_BASE.low.hex}]`,
  },
};

/**
 * Priority colors with hex values for use in non-Tailwind contexts (light mode)
 */
export const PRIORITY_COLORS_HEX: Record<
  TaskPriority,
  { bg: string; border: string; text: string }
> = {
  urgent: { bg: PRIORITY_BASE.urgent.hex, border: '#C4293F', text: '#ffffff' },
  high:   { bg: PRIORITY_BASE.high.hex,   border: '#D48E15', text: '#ffffff' },
  medium: { bg: PRIORITY_BASE.medium.hex,  border: '#1E45C0', text: '#ffffff' },
  low:    { bg: PRIORITY_BASE.low.hex,     border: '#0B8A6A', text: '#ffffff' },
};

/**
 * Priority hex colors for dark mode (softer tones on dark backgrounds)
 */
export const PRIORITY_COLORS_HEX_DARK: Record<
  TaskPriority,
  { bg: string; border: string; text: string }
> = {
  urgent: { bg: PRIORITY_BASE.urgent.darkHex, border: PRIORITY_BASE.urgent.hex, text: '#ffffff' },
  high:   { bg: PRIORITY_BASE.high.darkHex,   border: PRIORITY_BASE.high.hex,   text: '#ffffff' },
  medium: { bg: PRIORITY_BASE.medium.darkHex,  border: PRIORITY_BASE.medium.hex,  text: '#ffffff' },
  low:    { bg: PRIORITY_BASE.low.darkHex,     border: PRIORITY_BASE.low.hex,     text: '#ffffff' },
};

/** Priority flag hex colors for SVG rendering */
export const PRIORITY_FLAG_COLORS: Record<string, string> = {
  urgent: PRIORITY_BASE.urgent.hex,
  high:   PRIORITY_BASE.high.hex,
  medium: PRIORITY_BASE.medium.hex,
  low:    PRIORITY_BASE.low.hex,
};

/** Card border colors derived from PRIORITY_BASE */
const BORDER_COLORS: Record<string, string> = {
  urgent: PRIORITY_BASE.urgent.hex,
  high:   PRIORITY_BASE.high.hex,
  medium: PRIORITY_BASE.medium.hex,
  low:    PRIORITY_BASE.low.hex,
};

// =============================================================================
// Column header colors
// =============================================================================

/** Column colors with light and dark mode variants */
export const COLUMN_COLORS: readonly { light: string; dark: string }[] = [
  { light: 'var(--primary)', dark: 'var(--primary)' },
  { light: '#0079BF',        dark: '#4DA8DA' },
  { light: '#61BD4F',        dark: '#7DD868' },
  { light: '#E8445A',        dark: '#F4707F' },
  { light: '#F5A623',        dark: '#F5C060' },
  { light: '#C377E0',        dark: '#D49EF0' },
  { light: '#00C2E0',        dark: '#3DD8F0' },
  { light: '#0FA882',        dark: '#3DC9A5' },
  { light: '#2D5BE3',        dark: '#5B82F0' },
  { light: '#FF78CB',        dark: '#FF9EDB' },
  { light: '#344563',        dark: '#6B7D9A' },
  { light: '#B3BAC5',        dark: '#D0D5DD' },
] as const;

/**
 * @deprecated Use COLUMN_COLORS instead. Kept for backward compatibility.
 */
export const COLUMN_HEADER_COLORS: string[] = COLUMN_COLORS.map((c) => c.light);

/**
 * @deprecated Use COLUMN_COLORS instead. Kept for backward compatibility.
 */
export const COLUMN_HEADER_COLORS_DARK: string[] = COLUMN_COLORS.map((c) => c.dark);

/**
 * Get a column header color by index, theme-aware
 * @param index - column index (wraps around)
 * @param isDark - when true, returns dark-mode colors
 */
export function getColumnHeaderColor(index: number, isDark?: boolean): string {
  const safeIndex =
    ((index % COLUMN_COLORS.length) + COLUMN_COLORS.length) % COLUMN_COLORS.length;
  const entry = COLUMN_COLORS[safeIndex];
  return isDark ? entry.dark : entry.light;
}

// =============================================================================
// Column status indicator colors
// =============================================================================

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

// =============================================================================
// Public utility functions (signatures unchanged)
// =============================================================================

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
      const fallbackP = task.priority.toLowerCase();
      return PRIORITY_FLAG_COLORS[fallbackP] ?? null;
    }
  }
}

// --- Card-specific color utilities ---

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #2D5BE3, #4B74F0)',
  'linear-gradient(135deg, #0FA882, #14b8a6)',
  'linear-gradient(135deg, #F5A623, #E8445A)',
  'linear-gradient(135deg, #5C6B8A, #2D5BE3)',
];

export function getBorderColor(priority: string): string {
  return BORDER_COLORS[priority] || '#9ca3af';
}

export function getPriorityFlagColor(priority: string): string {
  return PRIORITY_FLAG_COLORS[priority] || '#9ca3af';
}

export function formatDueDate(date: string): string {
  const dueDate = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isToday(date)) {
    return 'Today';
  }

  if (
    dueDate.getDate() === tomorrow.getDate() &&
    dueDate.getMonth() === tomorrow.getMonth() &&
    dueDate.getFullYear() === tomorrow.getFullYear()
  ) {
    return 'Tomorrow';
  }

  if (isOverdue(date)) {
    return 'Overdue';
  }

  return dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getAvatarGradient(index: number): string {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
}

export function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getDueDateColors(dueDate: string | null | undefined): {
  class: string;
  chipClass: string;
} {
  return getDueDateColor(dueDate ?? null);
}

export function getOverflowLabelsTooltip(
  labels: { name: string }[] | null | undefined,
): string {
  if (!labels || labels.length <= 2) return '';
  return labels
    .slice(2)
    .map((l) => l.name)
    .join(', ');
}

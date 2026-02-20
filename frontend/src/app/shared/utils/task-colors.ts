import { TaskPriority } from '../../core/services/task.service';

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
    bg: '#ef4444',
    border: '#dc2626',
    text: '#ffffff',
  },
  high: {
    bg: '#f97316',
    border: '#ea580c',
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
 * Get priority hex color values by priority string
 */
export function getPriorityColorHex(priority: string): {
  bg: string;
  border: string;
  text: string;
} {
  const normalizedPriority = priority.toLowerCase() as TaskPriority;
  return (
    PRIORITY_COLORS_HEX[normalizedPriority] || {
      bg: '#9ca3af',
      border: '#6b7280',
      text: '#ffffff',
    }
  );
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

/** Priority flag hex colors for SVG rendering */
export const PRIORITY_FLAG_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
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

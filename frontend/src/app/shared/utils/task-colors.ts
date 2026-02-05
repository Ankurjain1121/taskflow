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
    bg: 'bg-red-500',
    text: 'text-white',
    border: 'border-red-600',
    dot: 'bg-red-400',
  },
  high: {
    bg: 'bg-orange-500',
    text: 'text-white',
    border: 'border-orange-600',
    dot: 'bg-orange-400',
  },
  medium: {
    bg: 'bg-yellow-400',
    text: 'text-yellow-900',
    border: 'border-yellow-500',
    dot: 'bg-yellow-300',
  },
  low: {
    bg: 'bg-blue-400',
    text: 'text-white',
    border: 'border-blue-500',
    dot: 'bg-blue-300',
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
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
];

/**
 * Column status indicator colors
 */
export const COLUMN_STATUS_COLORS = {
  default: { bg: 'bg-gray-200', text: 'text-gray-700' },
  done: { bg: 'bg-green-100', text: 'text-green-800' },
  inProgress: { bg: 'bg-blue-100', text: 'text-blue-800' },
  blocked: { bg: 'bg-red-100', text: 'text-red-800' },
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
export function getDueDateColor(dueDate: string | null): string {
  if (!dueDate) return 'text-gray-500';
  if (isOverdue(dueDate)) return 'text-red-600';
  if (isToday(dueDate)) return 'text-amber-600';
  return 'text-gray-500';
}

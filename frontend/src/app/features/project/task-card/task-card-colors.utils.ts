import {
  getDueDateColor,
  isOverdue,
  isToday,
  PRIORITY_FLAG_COLORS,
} from '../../../shared/utils/task-colors';

const BORDER_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #3b82f6, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #10b981, #14b8a6)',
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

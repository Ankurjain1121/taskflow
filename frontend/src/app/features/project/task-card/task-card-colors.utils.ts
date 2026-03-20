import {
  getDueDateColor,
  isOverdue,
  isToday,
  PRIORITY_FLAG_COLORS,
} from '../../../shared/utils/task-colors';

const BORDER_COLORS: Record<string, string> = {
  urgent: '#E8445A',
  high: '#F5A623',
  medium: '#2D5BE3',
  low: '#0FA882',
};

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

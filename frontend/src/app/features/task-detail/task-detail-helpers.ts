import { TaskPriority } from '../../core/services/task.service';
import {
  PRIORITY_COLORS_HEX,
  getPriorityLabel,
  isOverdue,
  isToday,
} from '../../shared/utils/task-colors';

const AVATAR_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
];

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export function getAvatarColor(name: string | undefined | null): string {
  if (!name) return AVATAR_COLORS[0];
  const code = name.charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export function getPriorityColor(priority: TaskPriority): string {
  return PRIORITY_COLORS_HEX[priority]?.bg ?? '#94a3b8';
}

export function getPriorityIcon(priority: TaskPriority): string {
  return getPriorityLabel(priority);
}

export function getDueDateDisplayColor(dateStr: string): string {
  if (isOverdue(dateStr)) return 'var(--status-red-text)';
  if (isToday(dateStr)) return 'var(--status-amber-text)';
  return 'var(--foreground)';
}

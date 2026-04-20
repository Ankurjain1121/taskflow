import { MenuItem } from 'primeng/api';
import { Task } from '../../../core/services/task.service';
import { Column } from '../../../core/services/project.service';
import { PRIORITY_COLORS } from '../../../shared/constants/priority-colors';

export interface ContextMenuCallbacks {
  onPriorityChanged: (taskId: string, priority: string) => void;
  onColumnMoveRequested: (taskId: string, columnId: string) => void;
  onMoveToProjectRequested?: (taskId: string) => void;
  onDuplicateRequested: (taskId: string) => void;
  onDeleteRequested: (taskId: string) => void;
  onMarkDoneRequested?: () => void;
}

export function buildContextMenu(
  task: Task,
  columns: Column[],
  statusTransitions: Record<string, string[] | null>,
  callbacks: ContextMenuCallbacks,
  isDoneColumn: boolean = false,
): MenuItem[] {
  const priorities = [
    { label: 'Urgent', value: 'urgent', color: PRIORITY_COLORS['urgent'] },
    { label: 'High', value: 'high', color: PRIORITY_COLORS['high'] },
    { label: 'Medium', value: 'medium', color: PRIORITY_COLORS['medium'] },
    { label: 'Low', value: 'low', color: PRIORITY_COLORS['low'] },
  ];

  const currentStatusId = task.status_id ?? task.column_id ?? '';

  return [
    ...(callbacks.onMarkDoneRequested
      ? [
          {
            label: isDoneColumn ? 'Mark incomplete' : 'Mark done',
            icon: isDoneColumn ? 'pi pi-replay' : 'pi pi-check',
            command: () => callbacks.onMarkDoneRequested!(),
          },
          { separator: true },
        ]
      : []),
    {
      label: 'Set Priority',
      icon: 'pi pi-flag',
      items: priorities.map((p) => ({
        label: p.label,
        command: () => callbacks.onPriorityChanged(task.id, p.value),
      })),
    },
    {
      label: 'Move to Column',
      icon: 'pi pi-arrow-right',
      items: columns
        .filter((col) => col.id !== (task.status_id ?? task.column_id))
        .map((col) => {
          const allowed = statusTransitions[currentStatusId];
          const isAllowed =
            allowed === null || allowed === undefined
              ? true
              : allowed.includes(col.id);
          return {
            label: col.name,
            disabled: !isAllowed,
            styleClass: isAllowed ? '' : 'opacity-50',
            command: () => {
              if (isAllowed) {
                callbacks.onColumnMoveRequested(task.id, col.id);
              }
            },
          };
        }),
    },
    ...(callbacks.onMoveToProjectRequested
      ? [
          {
            label: 'Move to Project',
            icon: 'pi pi-share-alt',
            command: () => callbacks.onMoveToProjectRequested!(task.id),
          },
        ]
      : []),
    {
      label: 'Duplicate',
      icon: 'pi pi-copy',
      command: () => callbacks.onDuplicateRequested(task.id),
    },
    {
      label: 'Copy Link',
      icon: 'pi pi-link',
      command: () => {
        const url = `${window.location.origin}/task/${task.id}`;
        navigator.clipboard.writeText(url);
      },
    },
    { separator: true },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      disabled: false,
      style: { color: 'var(--red-500)' },
      command: () => {
        if (confirm(`Delete "${task.title}"?`)) {
          callbacks.onDeleteRequested(task.id);
        }
      },
    },
  ];
}

import { Task } from '../../../core/services/task.service';
import { GroupByMode, SwimlaneGroup, SwimlaneState } from './swimlane.types';

export const NONE_KEY = 'none';

export const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

export const PRIORITY_CONFIG: Record<string, { label: string; color: string }> =
  {
    urgent: { label: 'Urgent', color: '#ef4444' },
    high: { label: 'High', color: '#f97316' },
    medium: { label: 'Medium', color: '#facc15' },
    low: { label: 'Low', color: '#60a5fa' },
  };

export function buildSwimlaneGroups(
  state: Record<string, Task[]>,
  mode: GroupByMode,
): SwimlaneGroup[] {
  if (mode === 'none') return [];

  if (mode === 'priority') {
    return [
      ...PRIORITY_ORDER.map((key) => ({
        key,
        label: PRIORITY_CONFIG[key].label,
        color: PRIORITY_CONFIG[key].color,
        isNone: false,
      })),
      { key: NONE_KEY, label: 'No Priority', isNone: true },
    ];
  }

  const seen = new Map<string, SwimlaneGroup>();
  let hasNone = false;

  for (const tasks of Object.values(state)) {
    for (const task of tasks) {
      if (mode === 'assignee') {
        if (task.assignees?.length) {
          for (const a of task.assignees) {
            if (!seen.has(a.id)) {
              seen.set(a.id, {
                key: a.id,
                label: a.display_name || 'Unknown',
                avatarUrl: a.avatar_url ?? undefined,
                isNone: false,
              });
            }
          }
        } else {
          hasNone = true;
        }
      } else if (mode === 'label') {
        if (task.labels?.length) {
          for (const l of task.labels) {
            if (!seen.has(l.id)) {
              seen.set(l.id, {
                key: l.id,
                label: l.name,
                color: l.color,
                isNone: false,
              });
            }
          }
        } else {
          hasNone = true;
        }
      }
    }
  }

  const groups = [...seen.values()];
  if (hasNone || groups.length === 0) {
    groups.push({
      key: NONE_KEY,
      label: mode === 'assignee' ? 'No Assignee' : 'No Label',
      isNone: true,
    });
  }
  return groups;
}

export function buildSwimlaneState(
  filteredState: Record<string, Task[]>,
  groups: SwimlaneGroup[],
  mode: GroupByMode,
): SwimlaneState {
  if (mode === 'none' || groups.length === 0) return {};

  const result: SwimlaneState = {};
  for (const group of groups) {
    result[group.key] = {};
    for (const colId of Object.keys(filteredState)) {
      result[group.key][colId] = [];
    }
  }

  for (const [colId, tasks] of Object.entries(filteredState)) {
    for (const task of tasks) {
      const groupKey = getTaskGroupKey(task, mode);
      if (result[groupKey]) {
        result[groupKey][colId].push(task);
      } else if (result[NONE_KEY]) {
        result[NONE_KEY][colId].push(task);
      }
    }
  }

  return result;
}

function getTaskGroupKey(task: Task, mode: GroupByMode): string {
  if (mode === 'assignee') {
    return task.assignees?.[0]?.id ?? NONE_KEY;
  }
  if (mode === 'priority') {
    return task.priority && PRIORITY_CONFIG[task.priority]
      ? task.priority
      : NONE_KEY;
  }
  if (mode === 'label') {
    return task.labels?.[0]?.id ?? NONE_KEY;
  }
  return NONE_KEY;
}

/** Build a CDK drop list ID for a swimlane cell.
 *  Format: "cell_{colId (36-char UUID)}_{groupKey}"
 *  Unambiguous because UUIDs use only hyphens, no underscores.
 */
export function makeCellId(colId: string, groupKey: string): string {
  return `cell_${colId}_${groupKey}`;
}

/** Parse a cell ID back into { colId, groupKey }. */
export function parseCellId(cellId: string): {
  colId: string;
  groupKey: string;
} {
  // "cell_" = 5 chars, UUID = 36 chars, "_" = 1 char → groupKey starts at 42
  const colId = cellId.substring(5, 41);
  const groupKey = cellId.substring(42);
  return { colId, groupKey };
}

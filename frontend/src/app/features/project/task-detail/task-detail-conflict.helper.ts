import {
  ConflictError,
  Task,
  Assignee,
  Label,
} from '../../../core/services/task.service';
import { ConflictResolution } from '../../../shared/components/conflict-dialog/conflict-dialog.component';
import { TaskDependency } from '../../../core/services/dependency.service';
import { TaskListItem } from '../../../core/services/task.service';
import {
  TaskCustomFieldValueWithField,
  SetFieldValue,
} from '../../../core/services/custom-field.service';
import { TaskLockInfo } from '../../../core/services/presence.service';
import { MemberSearchResult } from '../../../core/services/workspace.service';

/**
 * Type guard: checks whether an error is a 409 ConflictError.
 */
export function isConflictError(error: unknown): error is ConflictError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as ConflictError).status === 409
  );
}

/**
 * If the resolution action is 'keep_mine', builds a request object
 * that includes the user's changes plus the server's version number.
 * Returns null if the resolution does not require a resubmit.
 */
export function buildConflictResubmitRequest(
  resolution: ConflictResolution,
): Partial<Task> | null {
  if (resolution.action === 'keep_mine' && resolution.yourChanges) {
    return {
      ...resolution.yourChanges,
      version: resolution.serverVersion,
    };
  }
  return null;
}

/**
 * Groups dependencies into blocking, blocked-by, and related buckets.
 */
export function groupDependencies(
  deps: TaskDependency[],
  taskId: string,
): {
  blocking: TaskDependency[];
  blockedBy: TaskDependency[];
  related: TaskDependency[];
} {
  return {
    blocking: deps.filter(
      (d) => d.dependency_type === 'blocks' && d.source_task_id === taskId,
    ),
    blockedBy: deps.filter(
      (d) => d.dependency_type === 'blocks' && d.target_task_id === taskId,
    ),
    related: deps.filter((d) => d.dependency_type === 'related'),
  };
}

/**
 * Filters board tasks for dependency search, excluding the current task
 * and any tasks already linked as dependencies.
 */
export function filterDependencyResults(
  boardTasks: TaskListItem[],
  currentTaskId: string,
  existingDeps: TaskDependency[],
  query: string,
  limit = 10,
): TaskListItem[] {
  const existingDepTaskIds = new Set(
    existingDeps.map((d) => d.related_task_id),
  );
  const lowerQuery = query.toLowerCase();
  return boardTasks
    .filter(
      (t) =>
        t.id !== currentTaskId &&
        !existingDepTaskIds.has(t.id) &&
        t.title.toLowerCase().includes(lowerQuery),
    )
    .slice(0, limit);
}

/**
 * Computes the request payload for a manual time entry log.
 * Returns null if the total duration is zero or negative.
 */
export function computeManualTimeEntry(event: {
  hours: number;
  minutes: number;
  description: string;
  date: string;
}): {
  description: string | undefined;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
} | null {
  const totalMinutes = event.hours * 60 + event.minutes;
  if (totalMinutes <= 0) return null;

  const startedAt = new Date(event.date + 'T09:00:00Z').toISOString();
  const endedAt = new Date(
    new Date(startedAt).getTime() + totalMinutes * 60000,
  ).toISOString();

  return {
    description: event.description || undefined,
    started_at: startedAt,
    ended_at: endedAt,
    duration_minutes: totalMinutes,
  };
}

/**
 * Formats elapsed seconds into HH:MM:SS string.
 */
export function formatElapsedTime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - start) / 1000);
  const hours = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Builds the update request with OCC version if available.
 */
export function buildUpdateRequest(
  task: Task,
  updates: Partial<Task>,
): Partial<Task> {
  return task.version ? { ...updates, version: task.version } : updates;
}

/**
 * Maps custom field values to the SetFieldValue format for persistence.
 */
export function buildCustomFieldValues(
  fields: TaskCustomFieldValueWithField[],
): SetFieldValue[] {
  return fields.map((f) => ({
    field_id: f.field_id,
    value_text: f.value_text,
    value_number: f.value_number,
    value_date: f.value_date,
    value_bool: f.value_bool,
  }));
}

/**
 * Checks if a task lock belongs to another user.
 * Returns the lock info if locked by someone else, null otherwise.
 */
export function checkLockByOther(
  locks: Map<string, TaskLockInfo>,
  taskId: string,
  currentUserId: string | undefined,
): TaskLockInfo | null {
  const lock = locks.get(taskId);
  if (lock && lock.user_id !== currentUserId) {
    return lock;
  }
  return null;
}

/**
 * Creates an optimistic task with a new assignee added.
 */
export function addAssigneeToTask(
  task: Task,
  member: MemberSearchResult,
): Task {
  const newAssignee: Assignee = {
    id: member.id,
    display_name: member.name || 'Unknown',
    avatar_url: member.avatar_url,
  };
  return {
    ...task,
    assignees: [...(task.assignees || []), newAssignee],
  };
}

/**
 * Creates an optimistic task with an assignee removed.
 */
export function removeAssigneeFromTask(
  task: Task,
  assigneeId: string,
): Task {
  return {
    ...task,
    assignees: (task.assignees || []).filter((a) => a.id !== assigneeId),
  };
}

/**
 * Creates an optimistic task with a label added.
 */
export function addLabelToTask(
  task: Task,
  label: Label,
): Task {
  const newLabel: Label = {
    id: label.id,
    workspace_id: label.workspace_id ?? '',
    name: label.name,
    color: label.color,
    created_at: label.created_at ?? '',
  };
  return {
    ...task,
    labels: [...(task.labels || []), newLabel],
  };
}

/**
 * Creates an optimistic task with a label removed.
 */
export function removeLabelFromTask(
  task: Task,
  labelId: string,
): Task {
  return {
    ...task,
    labels: (task.labels || []).filter((l) => l.id !== labelId),
  };
}

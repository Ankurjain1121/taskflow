import { Task } from '../../../core/services/task.service';
import { TaskMoveEvent } from '../kanban-column/kanban-column.component';

export type GroupByMode = 'none' | 'assignee' | 'priority' | 'label';

export interface SwimlaneGroup {
  key: string;        // assignee ID | priority string | label ID | 'none'
  label: string;      // "Alice", "High", "Bug", "No Assignee"
  color?: string;     // priority/label color hex
  avatarUrl?: string; // assignee avatar
  isNone: boolean;    // true for catch-all row
}

// Record<groupKey, Record<colId, Task[]>>
export type SwimlaneState = Record<string, Record<string, Task[]>>;

export interface SwimlaneTaskMoveEvent extends TaskMoveEvent {
  fromGroupKey: string;
  toGroupKey: string;
  groupBy: GroupByMode;
}

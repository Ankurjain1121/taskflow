import { Injectable } from '@angular/core';
import { isOverdue } from '../../../shared/utils/task-colors';
import { Task } from '../../../core/services/task.service';
import { TaskFilters } from '../project-toolbar/project-toolbar.component';

@Injectable()
export class ProjectFilterService {
  filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
    // Hoist expensive computations outside the loop
    const searchLower = filters.search?.toLowerCase();
    const startDate = filters.dueDateStart ? new Date(filters.dueDateStart) : null;
    const endDate = filters.dueDateEnd ? new Date(filters.dueDateEnd) : null;

    return tasks.filter((task) => {
      if (
        searchLower &&
        !task.title.toLowerCase().includes(searchLower)
      ) {
        return false;
      }

      if (
        filters.priorities.length > 0 &&
        !filters.priorities.includes(task.priority)
      ) {
        return false;
      }

      if (filters.assigneeIds.length > 0) {
        const hasMatchingAssignee = filters.assigneeIds.some((id) =>
          (task.assignees ?? []).some((a) => a.id === id),
        );
        if (!hasMatchingAssignee) {
          return false;
        }
      }

      if (startDate || endDate) {
        if (!task.due_date) {
          return false;
        }
        const dueDate = new Date(task.due_date);
        if (startDate && dueDate < startDate) {
          return false;
        }
        if (endDate && dueDate > endDate) {
          return false;
        }
      }

      if (filters.labelIds.length > 0) {
        const hasMatchingLabel = filters.labelIds.some((id) =>
          (task.labels ?? []).some((l) => l.id === id),
        );
        if (!hasMatchingLabel) {
          return false;
        }
      }

      if (filters.overdue) {
        if (!task.due_date || !isOverdue(task.due_date)) {
          return false;
        }
      }

      return true;
    });
  }
}

import { Injectable } from '@angular/core';
import { isOverdue } from '../../../shared/utils/task-colors';
import { Task } from '../../../core/services/task.service';
import { TaskFilters } from '../project-toolbar/project-toolbar.component';

@Injectable()
export class ProjectFilterService {
  filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
    return tasks.filter((task) => {
      if (
        filters.search &&
        !task.title.toLowerCase().includes(filters.search.toLowerCase())
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
        const taskAssigneeIds = task.assignees?.map((a) => a.id) || [];
        const hasMatchingAssignee = filters.assigneeIds.some((id) =>
          taskAssigneeIds.includes(id),
        );
        if (!hasMatchingAssignee) {
          return false;
        }
      }

      if (filters.dueDateStart || filters.dueDateEnd) {
        if (!task.due_date) {
          return false;
        }
        const dueDate = new Date(task.due_date);
        if (filters.dueDateStart && dueDate < new Date(filters.dueDateStart)) {
          return false;
        }
        if (filters.dueDateEnd && dueDate > new Date(filters.dueDateEnd)) {
          return false;
        }
      }

      if (filters.labelIds.length > 0) {
        const taskLabelIds = task.labels?.map((l) => l.id) || [];
        const hasMatchingLabel = filters.labelIds.some((id) =>
          taskLabelIds.includes(id),
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

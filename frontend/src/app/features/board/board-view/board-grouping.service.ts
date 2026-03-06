import { Injectable, signal } from '@angular/core';
import { GroupByMode } from './swimlane.types';

@Injectable()
export class BoardGroupingService {
  readonly groupBy = signal<GroupByMode>('none');
  readonly collapsedSwimlaneIds = signal<Set<string>>(new Set());

  loadGroupBy(projectId: string): void {
    try {
      const stored = localStorage.getItem(`tf_swimlane_${projectId}`);
      if (
        stored &&
        ['none', 'assignee', 'priority', 'label'].includes(stored)
      ) {
        this.groupBy.set(stored as GroupByMode);
      } else {
        this.groupBy.set('none');
      }
    } catch {
      this.groupBy.set('none');
    }
  }

  setGroupBy(mode: GroupByMode, projectId: string): void {
    this.groupBy.set(mode);
    localStorage.setItem(`tf_swimlane_${projectId}`, mode);
  }

  toggleSwimlaneCollapse(groupKey: string): void {
    const current = this.collapsedSwimlaneIds();
    const updated = new Set(current);
    if (updated.has(groupKey)) {
      updated.delete(groupKey);
    } else {
      updated.add(groupKey);
    }
    this.collapsedSwimlaneIds.set(updated);
  }
}

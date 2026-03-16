import { Injectable, signal } from '@angular/core';
import { Task, Label } from '../../../../core/services/task.service';
import { ProjectMember } from '../../../../core/services/project.service';

export type QuickEditField = 'priority' | 'assignee' | 'due-date' | 'label';

@Injectable()
export class CardQuickEditService {
  readonly currentTask = signal<Task | null>(null);
  readonly currentField = signal<QuickEditField | null>(null);
  readonly isOpen = signal<boolean>(false);
  readonly projectMembers = signal<ProjectMember[]>([]);
  readonly availableLabels = signal<Label[]>([]);
  readonly anchorRect = signal<DOMRect | null>(null);

  open(anchor: HTMLElement, field: QuickEditField, task: Task): void {
    this.currentTask.set(task);
    this.currentField.set(field);
    this.anchorRect.set(anchor.getBoundingClientRect());
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.currentTask.set(null);
    this.currentField.set(null);
    this.anchorRect.set(null);
  }

  setProjectMembers(members: ProjectMember[]): void {
    this.projectMembers.set(members);
  }

  setAvailableLabels(labels: Label[]): void {
    this.availableLabels.set(labels);
  }
}

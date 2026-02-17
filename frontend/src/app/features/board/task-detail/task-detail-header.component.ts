import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Task } from '../../../core/services/task.service';
import { Column } from '../../../core/services/board.service';

@Component({
  selector: 'app-task-detail-header',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (task(); as t) {
      <div class="space-y-2">
        <!-- Done badge -->
        @if (column()?.status_mapping?.done) {
          <p-tag value="Done" severity="success" />
        }

        <!-- Title (Inline Editable) -->
        <input
          pInputText
          type="text"
          [ngModel]="t.title"
          (ngModelChange)="onTitleInput($event)"
          (blur)="onTitleBlur()"
          (keydown.enter)="onTitleBlur()"
          class="w-full text-xl font-semibold"
          placeholder="Task title"
        />

        <!-- Footer info -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            @if (column(); as col) {
              <span
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
              >
                <span
                  class="w-2 h-2 rounded-full"
                  [style.background-color]="col.color || '#6366f1'"
                ></span>
                {{ col.name }}
              </span>
            }
          </div>
          <div class="text-xs text-gray-400">
            Created {{ formatDate(t.created_at) }}
          </div>
        </div>
      </div>
    }
  `,
})
export class TaskDetailHeaderComponent {
  task = input.required<Task | null>();
  column = input<Column | null>(null);

  titleChanged = output<string>();
  closeRequested = output<void>();

  private pendingTitle = '';

  onTitleInput(title: string): void {
    this.pendingTitle = title;
  }

  onTitleBlur(): void {
    const t = this.task();
    if (this.pendingTitle && t && this.pendingTitle !== t.title) {
      this.titleChanged.emit(this.pendingTitle);
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

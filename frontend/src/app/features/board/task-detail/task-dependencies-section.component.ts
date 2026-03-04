import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TaskListItem } from '../../../core/services/task.service';
import {
  TaskDependency,
  DependencyType,
} from '../../../core/services/dependency.service';

@Component({
  selector: 'app-task-dependencies-section',
  standalone: true,
  imports: [CommonModule, FormsModule, Select, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i class="pi pi-link text-gray-400"></i>
          <h3 class="text-sm font-medium text-[var(--card-foreground)]">
            Dependencies
          </h3>
          <span class="text-xs text-gray-400"
            >({{ dependencies().length }})</span
          >
        </div>
        <button
          (click)="toggleAddDependency()"
          class="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded"
        >
          <i class="pi pi-plus text-xs"></i>
          Add
        </button>
      </div>

      <!-- Add Dependency Form -->
      @if (showAddDependency()) {
        <div class="mb-3 bg-[var(--secondary)] rounded-md p-3 space-y-2">
          <p-select
            [ngModel]="selectedDepType()"
            (ngModelChange)="selectedDepType.set($event)"
            [options]="depTypeOptions"
            optionLabel="label"
            optionValue="value"
            styleClass="w-full"
          />
          <input
            pInputText
            type="text"
            [ngModel]="depSearchQuery()"
            (ngModelChange)="onDepSearchInput($event)"
            placeholder="Search tasks..."
            class="w-full"
          />
          @if (depSearchResults().length > 0) {
            <div
              class="max-h-40 overflow-y-auto border border-[var(--border)] rounded-md bg-[var(--card)]"
            >
              @for (t of depSearchResults(); track t.id) {
                <button
                  (click)="onSelectDepTask(t)"
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] text-left"
                >
                  <span
                    class="w-2 h-2 rounded-full flex-shrink-0"
                    [class.bg-red-500]="t.priority === 'urgent'"
                    [class.bg-orange-500]="t.priority === 'high'"
                    [class.bg-yellow-500]="t.priority === 'medium'"
                    [class.bg-blue-500]="t.priority === 'low'"
                  ></span>
                  <span class="truncate">{{ t.title }}</span>
                  <span class="text-xs text-gray-400 ml-auto flex-shrink-0">{{
                    t.column_name
                  }}</span>
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- Blocking -->
      @if (blockingDeps().length > 0) {
        <div class="mb-2">
          <span class="text-xs font-medium text-red-600 uppercase tracking-wide"
            >Blocking</span
          >
          <div class="mt-1 space-y-1">
            @for (dep of blockingDeps(); track dep.id) {
              <div
                class="flex items-center justify-between px-2 py-1.5 bg-red-50 rounded text-sm group"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-2 h-2 rounded-full flex-shrink-0"
                    [class.bg-red-500]="dep.related_task_priority === 'urgent'"
                    [class.bg-orange-500]="dep.related_task_priority === 'high'"
                    [class.bg-yellow-500]="
                      dep.related_task_priority === 'medium'
                    "
                    [class.bg-blue-500]="dep.related_task_priority === 'low'"
                  ></span>
                  <span class="truncate text-red-800">{{
                    dep.related_task_title
                  }}</span>
                  <span class="text-xs text-red-400 flex-shrink-0">{{
                    dep.related_task_column_name
                  }}</span>
                </div>
                <button
                  (click)="dependencyRemoved.emit(dep.id)"
                  class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-0.5"
                >
                  <i class="pi pi-times text-xs"></i>
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- Blocked by -->
      @if (blockedByDeps().length > 0) {
        <div class="mb-2">
          <span
            class="text-xs font-medium text-orange-600 uppercase tracking-wide"
            >Blocked by</span
          >
          <div class="mt-1 space-y-1">
            @for (dep of blockedByDeps(); track dep.id) {
              <div
                class="flex items-center justify-between px-2 py-1.5 bg-orange-50 rounded text-sm group"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-2 h-2 rounded-full flex-shrink-0"
                    [class.bg-red-500]="dep.related_task_priority === 'urgent'"
                    [class.bg-orange-500]="dep.related_task_priority === 'high'"
                    [class.bg-yellow-500]="
                      dep.related_task_priority === 'medium'
                    "
                    [class.bg-blue-500]="dep.related_task_priority === 'low'"
                  ></span>
                  <span class="truncate text-orange-800">{{
                    dep.related_task_title
                  }}</span>
                  <span class="text-xs text-orange-400 flex-shrink-0">{{
                    dep.related_task_column_name
                  }}</span>
                </div>
                <button
                  (click)="dependencyRemoved.emit(dep.id)"
                  class="opacity-0 group-hover:opacity-100 text-orange-400 hover:text-orange-600 p-0.5"
                >
                  <i class="pi pi-times text-xs"></i>
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- Related -->
      @if (relatedDeps().length > 0) {
        <div class="mb-2">
          <span
            class="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide"
            >Related</span
          >
          <div class="mt-1 space-y-1">
            @for (dep of relatedDeps(); track dep.id) {
              <div
                class="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-sm group"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-2 h-2 rounded-full flex-shrink-0"
                    [class.bg-red-500]="dep.related_task_priority === 'urgent'"
                    [class.bg-orange-500]="dep.related_task_priority === 'high'"
                    [class.bg-yellow-500]="
                      dep.related_task_priority === 'medium'
                    "
                    [class.bg-blue-500]="dep.related_task_priority === 'low'"
                  ></span>
                  <span class="truncate text-gray-800">{{
                    dep.related_task_title
                  }}</span>
                  <span class="text-xs text-gray-400 flex-shrink-0">{{
                    dep.related_task_column_name
                  }}</span>
                </div>
                <button
                  (click)="dependencyRemoved.emit(dep.id)"
                  class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[var(--foreground)] p-0.5"
                >
                  <i class="pi pi-times text-xs"></i>
                </button>
              </div>
            }
          </div>
        </div>
      }

      @if (dependencies().length === 0 && !showAddDependency()) {
        <div class="text-sm text-gray-400">No dependencies</div>
      }
    </div>
  `,
})
export class TaskDependenciesSectionComponent {
  dependencies = input<TaskDependency[]>([]);
  blockingDeps = input<TaskDependency[]>([]);
  blockedByDeps = input<TaskDependency[]>([]);
  relatedDeps = input<TaskDependency[]>([]);
  depSearchResults = input<TaskListItem[]>([]);

  dependencyAdded = output<{ targetTaskId: string; depType: DependencyType }>();
  dependencyRemoved = output<string>();
  depSearchChanged = output<string>();

  showAddDependency = signal(false);
  selectedDepType = signal<DependencyType>('blocks');
  depSearchQuery = signal('');

  depTypeOptions = [
    { value: 'blocks', label: 'Blocks' },
    { value: 'blocked_by', label: 'Blocked by' },
    { value: 'related', label: 'Related to' },
  ];

  toggleAddDependency(): void {
    this.showAddDependency.update((v) => !v);
    if (!this.showAddDependency()) {
      this.depSearchQuery.set('');
    }
  }

  onDepSearchInput(query: string): void {
    this.depSearchQuery.set(query);
    this.depSearchChanged.emit(query);
  }

  onSelectDepTask(targetTask: TaskListItem): void {
    this.dependencyAdded.emit({
      targetTaskId: targetTask.id,
      depType: this.selectedDepType(),
    });
    this.showAddDependency.set(false);
    this.depSearchQuery.set('');
  }
}

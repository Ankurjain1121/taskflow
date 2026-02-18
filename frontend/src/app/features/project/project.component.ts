import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CdkDropListGroup,
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Subscription, forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';
import {
  WebSocketService,
  WebSocketMessage,
} from '../../core/services/websocket.service';
import { Project, ProjectColumn } from '../../shared/types/project.types';
import {
  TaskCard,
  TaskWithDetails,
  TaskFilters,
  TaskAssigneeInfo,
} from '../../shared/types/task.types';
import { TaskCardComponent } from './task-card/task-card.component';
import { TaskDetailComponent } from './task-detail/task-detail.component';
import {
  TaskCreateDialogComponent,
  TaskCreateDialogResult,
} from './task-create-dialog/task-create-dialog.component';
import { TaskFilterBarComponent } from '../../shared/components/task-filter-bar/task-filter-bar.component';
import { TableViewComponent } from './table-view/table-view.component';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    TaskCardComponent,
    TaskDetailComponent,
    TaskCreateDialogComponent,
    TaskFilterBarComponent,
    TableViewComponent,
  ],
  template: `
    <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      <!-- Project header -->
      <div
        class="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm"
      >
        <div class="flex items-center gap-3">
          @if (project()?.color) {
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm shadow-sm"
              [style.background-color]="project()!.color"
            >
              <i class="pi pi-folder !text-[18px]"></i>
            </div>
          }
          <div>
            <h2
              class="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight"
            >
              {{ project()?.name }}
            </h2>
            @if (project()?.key_prefix) {
              <span class="text-[11px] font-mono text-gray-400 tracking-wide">{{
                project()!.key_prefix
              }}</span>
            }
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- View toggle - polished pill style -->
          <div
            class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700"
          >
            <button
              (click)="currentView.set('kanban')"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
              [class]="
                currentView() === 'kanban'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              "
            >
              <i class="pi pi-th-large !text-[16px]"></i>
              Board
            </button>
            <button
              (click)="currentView.set('table')"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
              [class]="
                currentView() === 'table'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              "
            >
              <i class="pi pi-list !text-[16px]"></i>
              Table
            </button>
          </div>

          <p-button
            label="New Task"
            icon="pi pi-plus"
            (onClick)="showCreateTask()"
            [rounded]="true"
            size="small"
          />
          <a
            [routerLink]="['settings']"
            class="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <i class="pi pi-cog !text-[20px]"></i>
          </a>
        </div>
      </div>

      <!-- Filter bar -->
      @if (!loading()) {
        <app-task-filter-bar
          [projectId]="projectId()"
          [members]="projectMembers()"
          (filtersChanged)="onFiltersChanged($event)"
        />
      }

      <!-- Loading state - skeleton shimmer -->
      @if (loading()) {
        <div class="flex-1 overflow-hidden p-4">
          <div class="flex gap-4 h-full">
            @for (i of [1, 2, 3, 4]; track i) {
              <div
                class="flex flex-col w-72 min-w-[18rem] rounded-xl overflow-hidden"
              >
                <!-- Skeleton column header -->
                <div
                  class="p-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
                    ></div>
                    <div
                      class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                    ></div>
                    <div
                      class="h-4 w-6 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"
                    ></div>
                  </div>
                </div>
                <!-- Skeleton cards -->
                <div
                  class="flex-1 bg-gray-100/50 dark:bg-gray-900/50 p-2 space-y-2"
                >
                  @for (j of [1, 2, 3]; track j) {
                    <div
                      class="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2 animate-pulse"
                    >
                      <div
                        class="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded"
                      ></div>
                      <div
                        class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded"
                      ></div>
                      <div
                        class="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"
                      ></div>
                      <div class="flex gap-1 mt-1">
                        <div
                          class="h-4 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"
                        ></div>
                        <div
                          class="h-4 w-14 bg-gray-200 dark:bg-gray-700 rounded-full"
                        ></div>
                      </div>
                      <div class="flex justify-between items-center mt-2">
                        <div
                          class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"
                        ></div>
                        <div class="flex -space-x-1">
                          <div
                            class="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700"
                          ></div>
                          <div
                            class="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700"
                          ></div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Kanban columns -->
      @if (!loading() && currentView() === 'kanban') {
        <div class="flex-1 overflow-x-auto p-4 scroll-smooth">
          <div class="flex gap-4 h-full" cdkDropListGroup>
            @for (col of columns(); track col.id) {
              <div
                class="flex flex-col w-72 min-w-[18rem] bg-gray-100/80 dark:bg-gray-900/80 rounded-xl shadow-sm border border-gray-200/50 dark:border-gray-800/50"
              >
                <!-- Column header -->
                <div
                  class="flex items-center justify-between px-3 py-2.5 relative"
                >
                  <!-- Color accent bar -->
                  <div
                    class="absolute top-0 left-2 right-2 h-[2px] rounded-full"
                    [style.background-color]="col.color || '#6366f1'"
                  ></div>

                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      [style.background-color]="col.color || '#6366f1'"
                    ></span>
                    <span
                      class="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate"
                      >{{ col.name }}</span
                    >
                    <span
                      class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0"
                    >
                      {{ getTasksForColumn(col.id).length }}
                    </span>
                  </div>

                  <div class="flex items-center gap-0.5">
                    @if (col.status_mapping?.['done']) {
                      <i
                        class="pi pi-check-circle text-green-500 !text-[16px]"
                      ></i>
                    }
                    <button
                      class="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                      (click)="showCreateTask(col.id)"
                      title="Add task to {{ col.name }}"
                    >
                      <i class="pi pi-plus !text-[16px]"></i>
                    </button>
                  </div>
                </div>

                <!-- Task cards -->
                <div
                  class="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]"
                  cdkDropList
                  [cdkDropListData]="getTasksForColumn(col.id)"
                  [id]="col.id"
                  (cdkDropListDropped)="onDrop($event)"
                >
                  @for (task of getTasksForColumn(col.id); track task.id) {
                    <app-task-card
                      [task]="task"
                      cdkDrag
                      (taskClicked)="openTaskDetail($event)"
                    />
                  } @empty {
                    <!-- Empty column placeholder -->
                    <div
                      class="flex flex-col items-center justify-center py-8 px-4"
                    >
                      <div
                        class="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg py-6 px-4 text-center transition-colors hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 group/empty cursor-pointer"
                        (click)="showCreateTask(col.id)"
                      >
                        <i
                          class="pi pi-inbox !text-[24px] text-gray-300 dark:text-gray-600 group-hover/empty:text-indigo-400 transition-colors mb-1"
                        ></i>
                        <p
                          class="text-xs text-gray-400 dark:text-gray-600 mb-2"
                        >
                          No tasks yet
                        </p>
                        <div
                          class="inline-flex items-center gap-1 text-xs font-medium text-gray-400 group-hover/empty:text-indigo-500 transition-colors"
                        >
                          <i class="pi pi-plus-circle !text-[14px]"></i>
                          Add a task
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Table view -->
      @if (!loading() && currentView() === 'table') {
        <div class="flex-1 overflow-y-auto p-4">
          <app-table-view
            [projectId]="projectId()"
            [columns]="columns()"
            [tasks]="allTasks()"
            (taskClicked)="openTaskDetail($event)"
          />
        </div>
      }

      <!-- Task detail slide-over -->
      @if (selectedTaskId()) {
        <app-task-detail
          [taskId]="selectedTaskId()!"
          [projectId]="projectId()"
          [workspaceId]="project()?.workspace_id || ''"
          [columns]="columns()"
          [projectName]="project()?.name || ''"
          (closed)="closeTaskDetail()"
          (taskUpdated)="onTaskUpdated($event)"
        />
      }

      <!-- Inline create task dialog -->
      <app-task-create-dialog
        [(visible)]="showCreateDialog"
        [columnId]="createDialogColumnId()"
        [columnName]="createDialogColumnName()"
        [columns]="columns()"
        (created)="onTaskCreated($event)"
      />
    </div>
  `,
})
export class ProjectComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private wsService = inject(WebSocketService);
  private messageService = inject(MessageService);

  private subscriptions: Subscription[] = [];

  project = signal<Project | null>(null);
  columns = signal<ProjectColumn[]>([]);
  projectState = signal<Map<string, TaskCard[]>>(new Map());
  loading = signal(true);
  selectedTaskId = signal<string | null>(null);
  projectId = signal('');
  currentFilters = signal<TaskFilters | undefined>(undefined);
  projectMembers = signal<TaskAssigneeInfo[]>([]);
  currentView = signal<'kanban' | 'table'>('kanban');

  // Create dialog state
  showCreateDialog = false;
  createDialogColumnId = signal('');
  createDialogColumnName = signal('');

  allTasks = computed(() => {
    const state = this.projectState();
    const tasks: TaskCard[] = [];
    for (const [, colTasks] of state) {
      tasks.push(...colTasks);
    }
    return tasks;
  });

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe((params) => {
      const id = params.get('projectId');
      if (id) {
        this.projectId.set(id);
        this.loadProject(id);
        this.connectWebSocket(id);
      }
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    const id = this.projectId();
    if (id) {
      this.wsService.disconnect();
    }
  }

  getTasksForColumn(columnId: string): TaskCard[] {
    return this.projectState().get(columnId) || [];
  }

  onDrop(event: CdkDragDrop<TaskCard[]>): void {
    const task = event.previousContainer.data[event.previousIndex];
    if (!task) return;

    // Take snapshot for rollback
    const snapshot = this.cloneProjectState();

    if (event.previousContainer === event.container) {
      // Reorder within same column
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    } else {
      // Move to different column
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }

    const targetColumnId = event.container.id;
    const tasksInTarget = event.container.data;

    // Determine before/after for position calculation
    const afterTaskId =
      event.currentIndex > 0
        ? tasksInTarget[event.currentIndex - 1]?.id
        : undefined;
    const beforeTaskId =
      event.currentIndex < tasksInTarget.length - 1
        ? tasksInTarget[event.currentIndex + 1]?.id
        : undefined;

    // Update local task column_id
    task.column_id = targetColumnId;

    // Optimistically update UI
    this.projectState.update((state) => new Map(state));

    // Send API request
    this.taskService
      .moveTaskPosition(task.id, {
        target_column_id: targetColumnId,
        after_task_id: afterTaskId,
        before_task_id: beforeTaskId,
      })
      .subscribe({
        error: () => {
          // Rollback on failure
          this.projectState.set(snapshot);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to move task. Reverted.',
            life: 3000,
          });
        },
      });
  }

  showCreateTask(columnId?: string): void {
    const targetColumn = columnId
      ? this.columns().find((c) => c.id === columnId) || this.columns()[0]
      : this.columns()[0];

    if (!targetColumn) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'No columns available. Create a column first.',
        life: 3000,
      });
      return;
    }

    this.createDialogColumnId.set(targetColumn.id);
    this.createDialogColumnName.set(targetColumn.name);
    this.showCreateDialog = true;
  }

  onTaskCreated(result: TaskCreateDialogResult): void {
    const createColumnId = result.column_id || this.createDialogColumnId();

    this.taskService
      .createProjectTask(this.projectId(), {
        title: result.title,
        description: result.description,
        priority: result.priority,
        column_id: createColumnId,
        due_date: result.due_date,
      })
      .subscribe({
        next: () => {
          this.loadTasks(this.projectId());
          this.messageService.add({
            severity: 'success',
            summary: 'Created',
            detail: 'Task created.',
            life: 2000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create task.',
            life: 3000,
          });
        },
      });
  }

  openTaskDetail(task: TaskCard): void {
    this.selectedTaskId.set(task.id);
  }

  closeTaskDetail(): void {
    this.selectedTaskId.set(null);
  }

  onTaskUpdated(updatedTask: TaskCard): void {
    this.projectState.update((state) => {
      const newState = new Map(state);
      // Find and update the task in its column
      for (const [colId, tasks] of newState) {
        const idx = tasks.findIndex((t) => t.id === updatedTask.id);
        if (idx !== -1) {
          const updated = [...tasks];
          updated[idx] = updatedTask;
          newState.set(colId, updated);
          break;
        }
      }
      return newState;
    });
  }

  onFiltersChanged(filters: TaskFilters): void {
    this.currentFilters.set(filters);
    this.loadTasks(this.projectId());
  }

  private loadProject(projectId: string): void {
    this.loading.set(true);

    forkJoin({
      project: this.projectService.getById(projectId),
      columns: this.projectService.listColumns(projectId),
      tasks: this.taskService.listByProject(projectId, this.currentFilters()),
    }).subscribe({
      next: ({ project, columns, tasks }) => {
        this.project.set(project);
        this.columns.set(columns);
        this.buildProjectState(columns, tasks);
        this.extractProjectMembers(tasks);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load project.',
          life: 3000,
        });
      },
    });
  }

  private loadTasks(projectId: string): void {
    this.taskService.listByProject(projectId, this.currentFilters()).subscribe({
      next: (tasks) => {
        this.buildProjectState(this.columns(), tasks);
        this.extractProjectMembers(tasks);
      },
    });
  }

  private extractProjectMembers(tasks: TaskWithDetails[]): void {
    const membersMap = new Map<string, TaskAssigneeInfo>();
    for (const task of tasks) {
      for (const assignee of task.assignees) {
        if (!membersMap.has(assignee.user_id)) {
          membersMap.set(assignee.user_id, assignee);
        }
      }
    }
    this.projectMembers.set(Array.from(membersMap.values()));
  }

  private buildProjectState(
    columns: ProjectColumn[],
    tasks: TaskWithDetails[],
  ): void {
    const state = new Map<string, TaskCard[]>();

    // Initialize all columns
    for (const col of columns) {
      state.set(col.id, []);
    }

    // Distribute tasks into columns
    for (const td of tasks) {
      const card: TaskCard = {
        id: td.task.id,
        title: td.task.title,
        description: td.task.description,
        priority: td.task.priority,
        due_date: td.task.due_date,
        column_id: td.task.column_id,
        position: td.task.position,
        display_id: td.task.display_id,
        assignees: td.assignees,
        labels: td.labels,
        comments_count: td.comments_count,
        attachments_count: td.attachments_count,
      };
      const colTasks = state.get(card.column_id);
      if (colTasks) {
        colTasks.push(card);
      }
    }

    // Sort tasks within each column by position
    for (const [, colTasks] of state) {
      colTasks.sort((a, b) => a.position.localeCompare(b.position));
    }

    this.projectState.set(state);
  }

  private cloneProjectState(): Map<string, TaskCard[]> {
    const clone = new Map<string, TaskCard[]>();
    for (const [colId, tasks] of this.projectState()) {
      clone.set(
        colId,
        tasks.map((t) => ({ ...t })),
      );
    }
    return clone;
  }

  private connectWebSocket(projectId: string): void {
    this.wsService.connect();
    this.wsService.send('subscribe', { channel: `project:${projectId}` });

    const sub = this.wsService.messages$.subscribe((msg: WebSocketMessage) => {
      this.handleWsMessage(msg);
    });
    this.subscriptions.push(sub);
  }

  private handleWsMessage(msg: WebSocketMessage): void {
    const payload = msg.payload as { event?: string } | undefined;
    const event = msg.type || payload?.event;
    switch (event) {
      case 'task.created':
      case 'task.updated':
      case 'task.moved':
      case 'task.deleted':
        this.loadTasks(this.projectId());
        break;
      case 'column.created':
      case 'column.updated':
      case 'column.deleted':
        // Reload entire project to refresh columns + tasks
        this.loadProject(this.projectId());
        break;
    }
  }
}

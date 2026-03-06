import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputTextModule } from 'primeng/inputtext';
import { ChipModule } from 'primeng/chip';
import {
  ProjectShareService,
  SharedProjectAccess,
} from '../../core/services/project-share.service';

@Component({
  selector: 'app-shared-board-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ProgressSpinnerModule,
    InputTextModule,
    ChipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="flex items-center justify-center h-screen">
        <p-progressSpinner
          [style]="{ width: '48px', height: '48px' }"
          strokeWidth="4"
        />
      </div>
    } @else if (needsPassword()) {
      <div
        class="flex items-center justify-center h-screen bg-[var(--secondary)]"
      >
        <div
          class="w-96 bg-[var(--card)] rounded-lg shadow-sm border p-6 text-center"
        >
          <i class="pi pi-lock text-6xl text-gray-400 mb-4 block"></i>
          <h2 class="text-xl font-semibold mb-4">Password Required</h2>
          <p class="text-[var(--muted-foreground)] mb-4">
            This board is password protected.
          </p>
          <div class="w-full mb-2">
            <label
              for="boardPassword"
              class="block text-sm font-medium text-[var(--foreground)] mb-1 text-left"
              >Password</label
            >
            <input
              id="boardPassword"
              pInputText
              type="password"
              [(ngModel)]="password"
              (keyup.enter)="submitPassword()"
              class="w-full"
            />
          </div>
          @if (passwordError()) {
            <p class="text-red-500 text-sm mb-2">{{ passwordError() }}</p>
          }
          <p-button
            label="Access Board"
            (onClick)="submitPassword()"
            styleClass="w-full mt-2"
          />
        </div>
      </div>
    } @else if (error()) {
      <div
        class="flex items-center justify-center h-screen bg-[var(--secondary)]"
      >
        <div
          class="w-96 bg-[var(--card)] rounded-lg shadow-sm border p-6 text-center"
        >
          <i
            class="pi pi-exclamation-circle text-6xl text-red-400 mb-4 block"
          ></i>
          <h2 class="text-xl font-semibold mb-2">Unable to Access Board</h2>
          <p class="text-[var(--muted-foreground)]">{{ error() }}</p>
        </div>
      </div>
    } @else if (project()) {
      <div class="min-h-screen bg-[var(--secondary)]">
        <!-- Header -->
        <div class="bg-[var(--card)] border-b px-6 py-4">
          <h1 class="text-2xl font-bold">{{ project()!.project_name }}</h1>
          <p class="text-sm text-[var(--muted-foreground)]">
            Shared board view (read-only)
          </p>
        </div>

        <!-- Kanban columns -->
        <div class="p-6 overflow-x-auto">
          <div class="flex gap-4 min-w-max">
            @for (column of project()!.columns; track column.id) {
              <div
                class="w-72 bg-[var(--secondary)] rounded-lg p-3 flex-shrink-0"
              >
                <div class="flex items-center gap-2 mb-3">
                  @if (column.color) {
                    <div
                      class="w-3 h-3 rounded-full"
                      [style.background-color]="column.color"
                    ></div>
                  }
                  <h3 class="font-semibold text-sm">{{ column.name }}</h3>
                  <span class="text-xs text-gray-400 ml-auto">
                    {{ getTasksForColumn(column.id).length }}
                  </span>
                </div>
                <div class="space-y-2">
                  @for (task of getTasksForColumn(column.id); track task.id) {
                    <div
                      class="bg-[var(--card)] rounded-lg shadow-sm border p-3"
                    >
                      <h4 class="font-medium text-sm mb-1">{{ task.title }}</h4>
                      @if (task.description) {
                        <p
                          class="text-xs text-[var(--muted-foreground)] line-clamp-2"
                        >
                          {{ task.description }}
                        </p>
                      }
                      <div class="flex items-center gap-2 mt-2">
                        <p-chip
                          [label]="task.priority"
                          [styleClass]="getPriorityClass(task.priority)"
                        />
                        @if (task.due_date) {
                          <span class="text-xs text-gray-400">{{
                            task.due_date | date: 'shortDate'
                          }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class SharedBoardViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private shareService = inject(ProjectShareService);

  loading = signal(true);
  project = signal<SharedProjectAccess | null>(null);
  error = signal<string | null>(null);
  needsPassword = signal(false);
  passwordError = signal<string | null>(null);
  password = '';

  private token = '';

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.error.set('Invalid share link');
      this.loading.set(false);
      return;
    }
    this.loadBoard();
  }

  loadBoard(password?: string) {
    this.loading.set(true);
    this.shareService.accessSharedBoard(this.token, password).subscribe({
      next: (data) => {
        this.project.set(data);
        this.loading.set(false);
        this.needsPassword.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 401 && err.error?.error?.code === 'UNAUTHORIZED') {
          this.needsPassword.set(true);
          if (password) {
            this.passwordError.set('Incorrect password');
          }
        } else if (err.status === 400) {
          this.error.set(
            err.error?.error?.message || 'This share link is no longer valid',
          );
        } else {
          this.error.set('Unable to access this board');
        }
      },
    });
  }

  submitPassword() {
    this.passwordError.set(null);
    this.loadBoard(this.password);
  }

  getTasksForColumn(columnId: string) {
    return this.project()?.tasks.filter((t) => t.column_id === columnId) || [];
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-[var(--secondary)] text-[var(--muted-foreground)]';
      default:
        return '';
    }
  }
}

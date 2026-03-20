import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';

import {
  WorkspaceService,
  Workspace,
} from '../../core/services/workspace.service';
import { WorkspaceMemberInfo } from '../../shared/types/workspace.types';
import { ProjectService, Board } from '../../core/services/project.service';
import {
  CreateProjectDialogComponent,
  CreateProjectDialogResult,
} from '../../shared/components/dialogs/create-project-dialog.component';
import { WorkspaceSettingsDialogService } from '../../core/services/workspace-settings-dialog.service';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    ProgressSpinner,
    CreateProjectDialogComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--background)] p-6 md:p-8">
      <div class="max-w-7xl mx-auto">
        <!-- Loading State -->
        @if (loading()) {
          <div class="flex items-center justify-center py-24">
            <p-progressSpinner
              [style]="{ width: '48px', height: '48px' }"
              strokeWidth="4"
            />
          </div>
        } @else if (error()) {
          <!-- Error State -->
          <div class="text-center py-24">
            <div class="text-red-500 text-lg mb-2">
              Failed to load workspace
            </div>
            <p class="text-[var(--muted-foreground)] mb-4">{{ error() }}</p>
            <p-button label="Retry" (onClick)="loadData()" />
          </div>
        } @else {
          <!-- Header -->
          <div class="flex items-center justify-between mb-8">
            <div>
              <h1 class="text-3xl font-bold text-[var(--foreground)]">
                {{ workspace()?.name }}
              </h1>
              <p class="text-[var(--muted-foreground)] mt-1">
                Workspace overview
              </p>
            </div>
            <div class="flex items-center gap-3">
              <a
                [routerLink]="['/workspace', workspaceId(), 'team']"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] bg-[var(--card)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
              >
                <i class="pi pi-users"></i>
                Team Overview
              </a>
              <button
                (click)="openSettings()"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] bg-[var(--card)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
              >
                <i class="pi pi-cog"></i>
                Settings
              </button>
            </div>
          </div>

          <!-- Stats Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div class="widget-card p-5 animate-fade-in-up stagger-1">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg bg-[var(--status-blue-bg)] flex items-center justify-center"
                >
                  <i class="pi pi-th-large text-blue-600"></i>
                </div>
                <div>
                  <p class="text-2xl font-bold text-[var(--foreground)]">
                    {{ boards().length }}
                  </p>
                  <p class="text-sm text-[var(--muted-foreground)]">
                    {{ boards().length === 1 ? 'Project' : 'Projects' }}
                  </p>
                </div>
              </div>
            </div>
            <div class="widget-card p-5 animate-fade-in-up stagger-2">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg bg-[var(--status-green-bg)] flex items-center justify-center"
                >
                  <i class="pi pi-users text-green-600"></i>
                </div>
                <div>
                  <p class="text-2xl font-bold text-[var(--foreground)]">
                    {{ members().length }}
                  </p>
                  <p class="text-sm text-[var(--muted-foreground)]">
                    {{ members().length === 1 ? 'Member' : 'Members' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Board Grid Header -->
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-xl font-semibold text-[var(--foreground)]">
              Projects
            </h2>
            <p-button
              icon="pi pi-plus"
              label="Create Project"
              (onClick)="openCreateProjectDialog()"
            />
          </div>

          <!-- Empty State -->
          @if (boards().length === 0) {
            <app-empty-state
              variant="board"
              (ctaClicked)="openCreateProjectDialog()"
            />
          } @else {
            <!-- Board Cards Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (board of boards(); track board.id; let i = $index) {
                <a
                  [routerLink]="[
                    '/workspace',
                    workspaceId(),
                    'project',
                    board.id,
                  ]"
                  class="animate-fade-in-up bg-[var(--card)] rounded-xl border border-[var(--border)] hover:shadow-md hover:border-[var(--primary)] transition-all duration-200 cursor-pointer group block overflow-hidden"
                  [style.animation-delay]="i * 0.06 + 's'"
                >
                  <!-- Colored top accent stripe -->
                  <div
                    class="h-1"
                    [style.background]="getBoardAccentColor(i)"
                  ></div>
                  <div class="p-5">
                    <div class="flex items-start justify-between mb-3">
                      <div
                        class="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                        [style.background]="getBoardAccentColor(i) + '18'"
                      >
                        <i
                          class="pi pi-objects-column"
                          [style.color]="getBoardAccentColor(i)"
                        ></i>
                      </div>
                      <i
                        class="pi pi-arrow-right text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors"
                      ></i>
                    </div>
                    <h3
                      class="text-lg font-semibold text-[var(--foreground)] mb-1 group-hover:text-[var(--primary)] transition-colors"
                    >
                      {{ board.name }}
                    </h3>
                    @if (board.description) {
                      <p
                        class="text-sm text-[var(--muted-foreground)] line-clamp-2 mb-3"
                      >
                        {{ board.description }}
                      </p>
                    } @else {
                      <p
                        class="text-sm text-[var(--muted-foreground)] italic mb-3"
                      >
                        No description
                      </p>
                    }
                    <div
                      class="flex items-center text-xs text-[var(--muted-foreground)]"
                    >
                      <i
                        class="pi pi-calendar mr-1"
                        style="font-size: 0.75rem;"
                      ></i>
                      Created {{ formatDate(board.created_at) }}
                    </div>
                  </div>
                </a>
              }
            </div>
          }
        }
      </div>
    </div>

    <!-- Create Board Dialog (PrimeNG) -->
    <app-create-project-dialog
      [(visible)]="showCreateProjectDialog"
      [workspaceId]="workspaceId()"
      [workspaceName]="workspace()?.name || 'Workspace'"
      (created)="onBoardCreated($event)"
    />
  `,
  styles: [
    `
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `,
  ],
})
export class WorkspaceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private workspaceService = inject(WorkspaceService);
  private projectService = inject(ProjectService);
  private settingsDialog = inject(WorkspaceSettingsDialogService);
  private ctx = inject(WorkspaceContextService);

  private paramMap = toSignal(this.route.paramMap);
  workspaceId = signal<string>('');
  workspace = signal<Workspace | null>(null);
  /** Reads the shared project list signal from ProjectService */
  readonly boards = this.projectService.projects;
  members = signal<WorkspaceMemberInfo[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  showCreateProjectDialog = signal(false);

  private boardAccentColors = [
    '#6366f1',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
  ];

  constructor() {
    effect(() => {
      const pm = this.paramMap();
      const id = pm?.get('workspaceId');
      if (id) {
        this.workspaceId.set(id);
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    // Data loading is handled by the effect reacting to paramMap changes
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    const id = this.workspaceId();

    // Load workspace details
    this.workspaceService.get(id).subscribe({
      next: (ws) => this.workspace.set(ws),
      error: () => {
        this.error.set('Could not load workspace details.');
        this.loading.set(false);
      },
    });

    // Load boards — listBoards() updates projectService.projects signal via tap
    this.projectService.listBoards(id).subscribe({
      error: () => {},
    });

    // Load members
    this.workspaceService.getMembers(id).subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);

        // Auto-open create project dialog if navigated with ?newProject=true
        const newProject = this.route.snapshot.queryParamMap.get('newProject');
        if (newProject === 'true') {
          this.openCreateProjectDialog();
        }
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openSettings(): void {
    this.settingsDialog.open(this.workspaceId());
  }

  openCreateProjectDialog(): void {
    this.showCreateProjectDialog.set(true);
  }

  onBoardCreated(result: CreateProjectDialogResult): void {
    this.projectService
      .createBoard(this.workspaceId(), {
        name: result.name,
        description: result.description,
        template: result.template,
      })
      .subscribe({
        next: () => {
          this.ctx.invalidateProjects(this.workspaceId());
        },
        error: () => {
          // Error handling - board creation failed
        },
      });
  }

  getBoardAccentColor(index: number): string {
    return this.boardAccentColors[index % this.boardAccentColors.length];
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

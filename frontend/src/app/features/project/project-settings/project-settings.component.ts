import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  ProjectService,
  Board,
} from '../../../core/services/project.service';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { ColumnManagerComponent } from '../column-manager/column-manager.component';
import { AutomationRulesComponent } from '../automations/automation-rules.component';
import { ProjectAdvancedSettingsComponent } from './project-advanced-settings.component';

@Component({
  selector: 'app-project-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    Toast,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    ColumnManagerComponent,
    AutomationRulesComponent,
    ProjectAdvancedSettingsComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--background)]">
      <div class="max-w-4xl mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
          <nav class="text-sm text-[var(--muted-foreground)] mb-2">
            <a
              [routerLink]="['/workspace', workspaceId, 'project', boardId]"
              class="hover:text-primary"
              >Back to Project</a
            >
          </nav>
          <h1 class="text-3xl font-bold text-[var(--foreground)]">
            Board Setup
          </h1>
          <p class="mt-2 text-[var(--muted-foreground)]">
            Configure your board's columns and rules.
          </p>
          <p class="mt-1 text-sm text-[var(--muted-foreground)]">
            Members, labels &amp; roles are workspace-wide.
            <a [routerLink]="['/workspace', workspaceId, 'manage']"
               class="hover:underline"
               style="color: var(--primary)">Go to Manage &rarr;</a>
          </p>
        </div>

        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <svg
              class="animate-spin h-8 w-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        } @else if (board()) {
          <!-- Error banner -->
          @if (errorMessage()) {
            <div
              class="mb-4 p-3 rounded-md text-sm text-[var(--status-red-text)] bg-[var(--status-red-bg)] border border-[var(--status-red-border)]"
            >
              {{ errorMessage() }}
            </div>
          }

          <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)">
            <p-tablist>
              <p-tab [value]="0">Columns</p-tab>
              <p-tab [value]="1">Automations</p-tab>
              <p-tab [value]="2">Advanced</p-tab>
            </p-tablist>
            <p-tabpanels>
              <!-- Tab 0: Columns -->
              <p-tabpanel [value]="0">
                <div class="py-6">
                  <app-column-manager [boardId]="boardId"></app-column-manager>
                </div>
              </p-tabpanel>

              <!-- Tab 1: Automations -->
              <p-tabpanel [value]="1">
                <div class="py-6">
                  @defer {
                    <app-automation-rules [boardId]="boardId" />
                  } @placeholder {
                    <ng-container *ngTemplateOutlet="spinnerTpl" />
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 2: Advanced -->
              <p-tabpanel [value]="2">
                <app-project-advanced-settings
                  [board]="board()"
                  [boardId]="boardId"
                  [workspaceId]="workspaceId"
                  (errorOccurred)="showError($event)"
                />
              </p-tabpanel>
            </p-tabpanels>
          </p-tabs>
        } @else {
          <div class="text-center py-12">
            <p class="text-[var(--muted-foreground)]">Project not found</p>
          </div>
        }
      </div>
    </div>

    <p-toast />

    <ng-template #spinnerTpl>
      <div class="flex items-center justify-center py-12">
        <svg
          class="animate-spin h-6 w-6 text-primary"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    </ng-template>
  `,
})
export class ProjectSettingsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);

  private params = toSignal(this.route.params);
  private queryParams = toSignal(this.route.queryParams);

  workspaceId = '';
  boardId = '';

  loading = signal(true);
  board = signal<Board | null>(null);
  errorMessage = signal<string | null>(null);
  activeTab = signal(0);

  constructor() {
    effect(() => {
      const p = this.params();
      if (p) {
        this.workspaceId = p['workspaceId'];
        this.boardId = p['projectId'];
        this.loadBoard();
      }
    });

    // Support ?tab=N query param to open specific tab
    effect(() => {
      const qp = this.queryParams();
      if (qp) {
        const tabParam = qp['tab'];
        if (tabParam !== undefined && tabParam !== null) {
          const tabIndex = parseInt(tabParam, 10);
          if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 2) {
            this.activeTab.set(tabIndex);
          }
        }
      }
    });
  }

  ngOnInit(): void {
    // Data loading is handled by effects reacting to route param changes
  }

  onTabChange(tabValue: unknown): void {
    const value = tabValue as number;
    this.activeTab.set(value);
  }

  onBoardUpdated(updated: Board): void {
    this.board.set(updated);
  }

  showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }

  private loadBoard(): void {
    this.loading.set(true);

    this.projectService.getBoard(this.boardId).subscribe({
      next: (board) => {
        this.board.set(board);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

}

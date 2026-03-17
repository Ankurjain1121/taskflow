import {
  Component,
  DestroyRef,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  ProjectService,
  Board,
  ProjectMember,
} from '../../../core/services/project.service';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { ColumnManagerComponent } from '../column-manager/column-manager.component';
import { AutomationRulesComponent } from '../automations/automation-rules.component';
import { AutomationTemplatesComponent } from '../automation-templates/automation-templates.component';
import { CustomFieldsManagerComponent } from '../custom-fields/custom-fields-manager.component';
import { MilestoneListComponent } from '../milestone-list/milestone-list.component';
import { ProjectGeneralSettingsComponent } from './project-general-settings.component';
import { ProjectMembersSettingsComponent } from './project-members-settings.component';
import { ProjectWorkflowSettingsComponent } from './project-workflow-settings.component';
import { ProjectAdvancedSettingsComponent } from './project-advanced-settings.component';
import { ProjectIntegrationsSettingsComponent } from './project-integrations-settings.component';

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
    AutomationTemplatesComponent,
    CustomFieldsManagerComponent,
    MilestoneListComponent,
    ProjectGeneralSettingsComponent,
    ProjectMembersSettingsComponent,
    ProjectWorkflowSettingsComponent,
    ProjectAdvancedSettingsComponent,
    ProjectIntegrationsSettingsComponent,
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
            Project Settings
          </h1>
          <p class="mt-2 text-[var(--muted-foreground)]">
            Configure your project's settings, columns, members, and integrations
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
              <p-tab [value]="0">General</p-tab>
              <p-tab [value]="1">Columns</p-tab>
              <p-tab [value]="2">Members</p-tab>
              <p-tab [value]="3">Automations</p-tab>
              <p-tab [value]="4">Templates</p-tab>
              <p-tab [value]="5">Custom Fields</p-tab>
              <p-tab [value]="6">Milestones</p-tab>
              <p-tab [value]="7">Integrations</p-tab>
              <p-tab [value]="8">Advanced</p-tab>
              <p-tab [value]="9">Workflow</p-tab>
            </p-tablist>
            <p-tabpanels>
              <!-- Tab 0: General -->
              <p-tabpanel [value]="0">
                <app-project-general-settings
                  [board]="board()"
                  [boardId]="boardId"
                  (boardUpdated)="onBoardUpdated($event)"
                  (errorOccurred)="showError($event)"
                />
              </p-tabpanel>

              <!-- Tab 1: Columns -->
              <p-tabpanel [value]="1">
                <div class="py-6">
                  <app-column-manager [boardId]="boardId"></app-column-manager>
                </div>
              </p-tabpanel>

              <!-- Tab 2: Members -->
              <p-tabpanel [value]="2">
                <app-project-members-settings
                  [boardId]="boardId"
                  [boardName]="board()?.name || ''"
                  [members]="members()"
                  (membersChanged)="members.set($event)"
                  (errorOccurred)="showError($event)"
                />
              </p-tabpanel>

              <!-- Tab 3: Automations -->
              <p-tabpanel [value]="3">
                <div class="py-6">
                  @defer {
                    <app-automation-rules [boardId]="boardId" />
                  } @placeholder {
                    <ng-container *ngTemplateOutlet="spinnerTpl" />
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 4: Templates -->
              <p-tabpanel [value]="4">
                <div class="py-6">
                  @defer {
                    <app-automation-templates [workspaceId]="workspaceId" />
                  } @placeholder {
                    <ng-container *ngTemplateOutlet="spinnerTpl" />
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 5: Custom Fields -->
              <p-tabpanel [value]="5">
                <div class="py-6">
                  @defer {
                    <app-custom-fields-manager [boardId]="boardId" />
                  } @placeholder {
                    <ng-container *ngTemplateOutlet="spinnerTpl" />
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 6: Milestones -->
              <p-tabpanel [value]="6">
                <div class="py-6">
                  @defer {
                    <app-milestone-list [boardId]="boardId" />
                  } @placeholder {
                    <ng-container *ngTemplateOutlet="spinnerTpl" />
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 7: Integrations -->
              <p-tabpanel [value]="7">
                <app-project-integrations-settings
                  [boardId]="boardId"
                  [boardName]="board()?.name || ''"
                />
              </p-tabpanel>

              <!-- Tab 8: Advanced -->
              <p-tabpanel [value]="8">
                <app-project-advanced-settings
                  [board]="board()"
                  [boardId]="boardId"
                  [workspaceId]="workspaceId"
                  (errorOccurred)="showError($event)"
                />
              </p-tabpanel>

              <!-- Tab 9: Workflow -->
              <p-tabpanel [value]="9">
                <app-project-workflow-settings
                  #workflowSettings
                  [boardId]="boardId"
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
  private destroyRef = inject(DestroyRef);

  private workflowSettings = viewChild<ProjectWorkflowSettingsComponent>('workflowSettings');

  workspaceId = '';
  boardId = '';

  loading = signal(true);
  board = signal<Board | null>(null);
  members = signal<ProjectMember[]>([]);
  errorMessage = signal<string | null>(null);
  activeTab = signal(0);

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.boardId = params['projectId'];
      this.loadBoard();
    });

    // Support ?tab=N query param to open specific tab
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((queryParams) => {
      const tabParam = queryParams['tab'];
      if (tabParam !== undefined && tabParam !== null) {
        const tabIndex = parseInt(tabParam, 10);
        if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 9) {
          this.activeTab.set(tabIndex);
        }
      }
    });
  }

  onTabChange(tabValue: unknown): void {
    const value = tabValue as number;
    this.activeTab.set(value);
    if (value === 9) {
      this.workflowSettings()?.loadWorkflow();
    }
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
        this.loadProjectMembers();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadProjectMembers(): void {
    this.projectService.getProjectMembers(this.boardId).subscribe({
      next: (members) => {
        this.members.set(members);
      },
      error: () => {
        // Error handling - failed to load members
      },
    });
  }
}

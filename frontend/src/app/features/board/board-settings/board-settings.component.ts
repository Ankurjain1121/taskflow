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
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  ProjectService,
  Board,
  ProjectMember,
} from '../../../core/services/board.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ColumnManagerComponent } from '../column-manager/column-manager.component';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { AutomationRulesComponent } from '../automations/automation-rules.component';
import { AutomationTemplatesComponent } from '../automation-templates/automation-templates.component';
import { CustomFieldsManagerComponent } from '../custom-fields/custom-fields-manager.component';
import { MilestoneListComponent } from '../milestone-list/milestone-list.component';
import { ShareSettingsComponent } from '../share/share-settings.component';
import { WebhookSettingsComponent } from '../webhooks/webhook-settings.component';
import { ImportDialogComponent } from '../import-export/import-dialog.component';
import { ExportDialogComponent } from '../import-export/export-dialog.component';
import { ArchiveService } from '../../../core/services/archive.service';
import { BoardGeneralSettingsComponent } from './board-general-settings.component';
import { BoardMembersSettingsComponent } from './board-members-settings.component';
import { BoardWorkflowSettingsComponent } from './board-workflow-settings.component';

@Component({
  selector: 'app-project-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ColumnManagerComponent,
    ConfirmDialog,
    Toast,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    AutomationRulesComponent,
    AutomationTemplatesComponent,
    CustomFieldsManagerComponent,
    MilestoneListComponent,
    ShareSettingsComponent,
    WebhookSettingsComponent,
    ImportDialogComponent,
    ExportDialogComponent,
    BoardGeneralSettingsComponent,
    BoardMembersSettingsComponent,
    BoardWorkflowSettingsComponent,
  ],
  providers: [ConfirmationService, MessageService],
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
                <app-board-general-settings
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
                <app-board-members-settings
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
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 4: Automation Templates -->
              <p-tabpanel [value]="4">
                <div class="py-6">
                  @defer {
                    <app-automation-templates [workspaceId]="workspaceId" />
                  } @placeholder {
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
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 5: Custom Fields -->
              <p-tabpanel [value]="5">
                <div class="py-6">
                  @defer {
                    <app-custom-fields-manager [boardId]="boardId" />
                  } @placeholder {
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
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 6: Milestones -->
              <p-tabpanel [value]="6">
                <div class="py-6">
                  @defer {
                    <app-milestone-list [boardId]="boardId" />
                  } @placeholder {
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
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 7: Integrations -->
              <p-tabpanel [value]="7">
                <div class="py-6 space-y-8">
                  <!-- Share Settings -->
                  @defer {
                    <section>
                      <app-share-settings [boardId]="boardId" />
                    </section>
                  } @placeholder {
                    <div class="flex items-center justify-center py-8">
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
                  }

                  <!-- Webhooks -->
                  @defer {
                    <section>
                      <app-webhook-settings [boardId]="boardId" />
                    </section>
                  } @placeholder {
                    <div class="flex items-center justify-center py-8">
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
                  }

                  <!-- Import / Export -->
                  <section class="bg-[var(--card)] shadow rounded-lg">
                    <div class="px-6 py-4 border-b border-[var(--border)]">
                      <h2 class="text-lg font-medium text-[var(--foreground)]">
                        Import / Export
                      </h2>
                    </div>
                    <div class="px-6 py-4 space-y-4">
                      <div class="flex items-center justify-between">
                        <div>
                          <h3
                            class="text-sm font-medium text-[var(--foreground)]"
                          >
                            Import Tasks
                          </h3>
                          <p class="text-sm text-[var(--muted-foreground)]">
                            Import tasks from JSON, CSV, or Trello exports.
                          </p>
                        </div>
                        <button
                          (click)="showImportDialog.set(true)"
                          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors"
                        >
                          <i class="pi pi-upload"></i>
                          Import
                        </button>
                      </div>
                      <div class="border-t border-[var(--border)]"></div>
                      <div class="flex items-center justify-between">
                        <div>
                          <h3
                            class="text-sm font-medium text-[var(--foreground)]"
                          >
                            Export Board
                          </h3>
                          <p class="text-sm text-[var(--muted-foreground)]">
                            Export all tasks to CSV or JSON format.
                          </p>
                        </div>
                        <button
                          (click)="showExportDialog.set(true)"
                          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors"
                        >
                          <i class="pi pi-download"></i>
                          Export
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </p-tabpanel>

              <!-- Tab 8: Advanced (Danger Zone) -->
              <p-tabpanel [value]="8">
                <div class="py-6 space-y-6">
                  <!-- Archive Project -->
                  <section>
                    <div class="bg-[var(--card)] shadow rounded-lg">
                      <div class="px-6 py-4 border-b border-[var(--border)]">
                        <h2
                          class="text-lg font-medium text-[var(--foreground)]"
                        >
                          Archive
                        </h2>
                      </div>
                      <div class="px-6 py-4">
                        <div class="flex items-center justify-between">
                          <div>
                            <h3
                              class="text-sm font-medium text-[var(--foreground)]"
                            >
                              Archive Board
                            </h3>
                            <p class="text-sm text-[var(--muted-foreground)]">
                              Hide this board from the sidebar. It can be
                              restored later from the Archived section.
                            </p>
                          </div>
                          <button
                            (click)="onArchiveBoard()"
                            [disabled]="archiving()"
                            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-50 transition-colors disabled:opacity-50"
                          >
                            @if (archiving()) {
                              <svg
                                class="animate-spin h-4 w-4"
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
                              Archiving...
                            } @else {
                              <i class="pi pi-inbox"></i>
                              Archive Board
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  @if (canDeleteBoard()) {
                    <section>
                      <div
                        class="shadow rounded-lg border-2"
                        style="background: var(--card); border-color: var(--status-red-border)"
                      >
                        <div
                          class="px-6 py-4"
                          style="border-bottom: 1px solid var(--status-red-border); background: var(--status-red-bg)"
                        >
                          <h2
                            class="text-lg font-medium"
                            style="color: var(--status-red-text)"
                          >
                            Danger Zone
                          </h2>
                        </div>
                        <div class="px-6 py-4">
                          <div class="flex items-center justify-between">
                            <div>
                              <h3
                                class="text-sm font-medium text-[var(--foreground)]"
                              >
                                Delete Board
                              </h3>
                              <p class="text-sm text-[var(--muted-foreground)]">
                                Permanently delete this board and all its tasks.
                                This action cannot be undone.
                              </p>
                            </div>
                            <button
                              (click)="onDeleteBoard()"
                              [disabled]="deleting()"
                              class="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                              style="border: 1px solid var(--status-red-border); color: var(--status-red-text); background: var(--card)"
                            >
                              @if (deleting()) {
                                <svg
                                  class="animate-spin -ml-1 mr-2 h-4 w-4"
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
                                Deleting...
                              } @else {
                                Delete Board
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 9: Workflow (Transition Matrix) -->
              <p-tabpanel [value]="9">
                <app-board-workflow-settings
                  [boardId]="boardId"
                  #workflowSettings
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

    <p-confirmDialog />
    <app-import-dialog
      [(visible)]="showImportDialog"
      [boardId]="boardId"
      [boardName]="board()?.name || ''"
    />
    <app-export-dialog
      [(visible)]="showExportDialog"
      [boardId]="boardId"
      [boardName]="board()?.name || ''"
    />
    <p-toast />
  `,
})
export class ProjectSettingsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private archiveService = inject(ArchiveService);
  private destroyRef = inject(DestroyRef);

  private workflowSettingsRef = viewChild<BoardWorkflowSettingsComponent>('workflowSettings');

  workspaceId = '';
  boardId = '';

  loading = signal(true);
  deleting = signal(false);
  archiving = signal(false);
  board = signal<Board | null>(null);
  members = signal<ProjectMember[]>([]);
  showImportDialog = signal(false);
  showExportDialog = signal(false);
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
      const workflowRef = this.workflowSettingsRef();
      if (workflowRef) {
        workflowRef.loadWorkflow();
      }
    }
  }

  onBoardUpdated(updated: Board): void {
    this.board.set(updated);
  }

  canDeleteBoard(): boolean {
    return !!this.authService.currentUser();
  }

  onDeleteBoard(): void {
    const board = this.board();
    if (!board) return;

    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${board.name}"? This action cannot be undone. All tasks, columns, and data will be permanently lost.`,
      header: 'Delete Board',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.deleting.set(true);

        this.projectService.deleteBoard(this.boardId).subscribe({
          next: () => {
            this.router.navigate(['/workspace', this.workspaceId]);
          },
          error: () => {
            this.deleting.set(false);
          },
        });
      },
    });
  }

  onArchiveBoard(): void {
    const board = this.board();
    if (!board) return;

    this.confirmationService.confirm({
      message: `Archive "${board.name}"? It will be hidden from the sidebar but can be restored later.`,
      header: 'Archive Board',
      icon: 'pi pi-inbox',
      acceptButtonStyleClass: 'p-button-warning p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.archiving.set(true);
        this.projectService.deleteBoard(this.boardId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Board Archived',
              detail: `"${board.name}" has been archived.`,
              life: 4000,
            });
            this.router.navigate(['/workspace', this.workspaceId]);
          },
          error: () => {
            this.archiving.set(false);
            this.showError('Failed to archive board');
          },
        });
      },
    });
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

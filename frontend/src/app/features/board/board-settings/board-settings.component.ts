import {
  Component,
  DestroyRef,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  FormsModule,
  Validators,
} from '@angular/forms';
import {
  ProjectService,
  Project,
  ProjectMember,
} from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ColumnManagerComponent } from '../column-manager/column-manager.component';
import {
  InviteMemberDialogComponent,
  InviteMemberDialogResult,
} from './invite-member-dialog.component';
import { PositionListComponent } from '../positions/position-list.component';
import { SaveTemplateDialogComponent } from '../project-templates/save-template-dialog.component';
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

@Component({
  selector: 'app-board-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    ColumnManagerComponent,
    InviteMemberDialogComponent,
    PositionListComponent,
    ConfirmDialog,
    SaveTemplateDialogComponent,
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
              [routerLink]="['/workspace', workspaceId, 'project', projectId]"
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
        } @else if (project()) {
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
            </p-tablist>
            <p-tabpanels>
              <!-- Tab 0: General -->
              <p-tabpanel [value]="0">
                <div class="py-6 space-y-8">
                  <!-- General Settings -->
                  <section class="animate-fade-in-up">
                    <div class="bg-[var(--card)] shadow rounded-lg">
                      <div class="px-6 py-4 border-b border-[var(--border)]">
                        <h2
                          class="text-lg font-medium text-[var(--foreground)]"
                        >
                          General
                        </h2>
                      </div>
                      <form
                        [formGroup]="form"
                        (ngSubmit)="onSave()"
                        class="px-6 py-4 space-y-4"
                      >
                        <div>
                          <label
                            for="name"
                            class="block text-sm font-medium text-[var(--foreground)]"
                            >Name</label
                          >
                          <input
                            type="text"
                            id="name"
                            formControlName="name"
                            class="mt-1 block w-full rounded-md border-[var(--border)] shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
                          />
                          @if (
                            form.controls['name'].invalid &&
                            form.controls['name'].touched
                          ) {
                            <p class="mt-1 text-sm text-red-600">
                              Name is required
                            </p>
                          }
                        </div>

                        <div>
                          <label
                            for="description"
                            class="block text-sm font-medium text-[var(--foreground)]"
                            >Description</label
                          >
                          <textarea
                            id="description"
                            formControlName="description"
                            rows="3"
                            class="mt-1 block w-full rounded-md border-[var(--border)] shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
                            placeholder="Add a description for this project..."
                          ></textarea>
                        </div>

                        <div class="flex justify-end pt-4">
                          <button
                            type="submit"
                            [disabled]="saving() || form.invalid || !form.dirty"
                            class="btn-press inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            @if (saving()) {
                              <svg
                                class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                              Saving...
                            } @else {
                              Save Changes
                            }
                          </button>
                        </div>
                      </form>
                    </div>
                  </section>

                  <!-- Project Color -->
                  <section class="animate-fade-in-up">
                    <div class="bg-[var(--card)] shadow rounded-lg">
                      <div class="px-6 py-4 border-b border-[var(--border)]">
                        <h2
                          class="text-lg font-medium text-[var(--foreground)]"
                        >
                          Project Color
                        </h2>
                      </div>
                      <div class="px-6 py-4">
                        <p class="text-sm text-[var(--muted-foreground)] mb-3">
                          Choose a background color for this project.
                        </p>
                        <div class="flex flex-wrap items-center gap-2">
                          @for (color of presetColors; track color) {
                            <button
                              [style.background-color]="color"
                              class="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                              [class.ring-2]="selectedColor() === color"
                              [class.ring-primary]="selectedColor() === color"
                              [class.ring-offset-2]="selectedColor() === color"
                              (click)="selectBoardColor(color)"
                              [title]="color"
                            ></button>
                          }
                          <button
                            class="w-8 h-8 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:border-[var(--foreground)] transition-colors"
                            (click)="clearProjectColor()"
                            title="Clear color"
                          >
                            <i class="pi pi-times text-xs"></i>
                          </button>
                        </div>
                        <p
                          class="text-sm text-[var(--muted-foreground)] mb-2 mt-4"
                        >
                          Gradients
                        </p>
                        <div class="flex flex-wrap items-center gap-2">
                          @for (gradient of presetGradients; track gradient) {
                            <button
                              [style.background]="gradient"
                              class="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                              [class.ring-2]="selectedColor() === gradient"
                              [class.ring-primary]="
                                selectedColor() === gradient
                              "
                              [class.ring-offset-2]="
                                selectedColor() === gradient
                              "
                              (click)="selectBoardColor(gradient)"
                              title="Gradient"
                            ></button>
                          }
                        </div>
                      </div>
                    </div>
                  </section>

                  <!-- Save as Template -->
                  <section class="animate-fade-in-up">
                    <div class="bg-[var(--card)] shadow rounded-lg">
                      <div class="px-6 py-4 border-b border-[var(--border)]">
                        <h2
                          class="text-lg font-medium text-[var(--foreground)]"
                        >
                          Template
                        </h2>
                      </div>
                      <div class="px-6 py-4">
                        <div class="flex items-center justify-between">
                          <div>
                            <h3
                              class="text-sm font-medium text-[var(--foreground)]"
                            >
                              Save Project as Template
                            </h3>
                            <p class="text-sm text-[var(--muted-foreground)]">
                              Save this project's structure as a reusable template
                              including all columns and tasks.
                            </p>
                          </div>
                          <button
                            (click)="showSaveTemplateDialog.set(true)"
                            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors"
                          >
                            <i class="pi pi-copy"></i>
                            Save as Template
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </p-tabpanel>

              <!-- Tab 1: Columns -->
              <p-tabpanel [value]="1">
                <div class="py-6">
                  <app-column-manager [projectId]="projectId"></app-column-manager>
                </div>
              </p-tabpanel>

              <!-- Tab 2: Members -->
              <p-tabpanel [value]="2">
                <div class="py-6 space-y-6">
                  <!-- Members Table -->
                  <div class="bg-[var(--card)] shadow rounded-lg">
                    <div class="px-6 py-4 border-b border-[var(--border)]">
                      <div class="flex items-center justify-between">
                        <h3
                          class="text-lg font-medium text-[var(--foreground)]"
                        >
                          Project Members
                        </h3>
                        <button
                          (click)="onInviteMember()"
                          class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                            />
                          </svg>
                          Add Member
                        </button>
                      </div>
                    </div>

                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-[var(--border)]">
                        <thead class="bg-[var(--muted)]">
                          <tr>
                            <th
                              class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                            >
                              Member
                            </th>
                            <th
                              class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                            >
                              Role
                            </th>
                            <th
                              class="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                            >
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody
                          class="bg-[var(--card)] divide-y divide-[var(--border)]"
                        >
                          @for (member of members(); track member.user_id) {
                            <tr class="hover:bg-[var(--muted)]">
                              <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center gap-3">
                                  <div
                                    class="w-10 h-10 rounded-full bg-[var(--secondary)] flex items-center justify-center text-sm font-medium text-[var(--muted-foreground)]"
                                  >
                                    @if (member.avatar_url) {
                                      <img
                                        [src]="member.avatar_url"
                                        [alt]="member.name"
                                        class="w-full h-full rounded-full object-cover"
                                      />
                                    } @else {
                                      {{
                                        getInitials(member.name || member.email)
                                      }}
                                    }
                                  </div>
                                  <div>
                                    <p
                                      class="text-sm font-medium text-[var(--foreground)]"
                                    >
                                      {{ member.name || 'Unknown' }}
                                    </p>
                                    <p
                                      class="text-sm text-[var(--muted-foreground)]"
                                    >
                                      {{ member.email }}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap">
                                @if (member.role === 'owner') {
                                  <span
                                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                                  >
                                    Owner
                                  </span>
                                } @else {
                                  <select
                                    [ngModel]="member.role"
                                    (ngModelChange)="
                                      onMemberRoleChange(member, $event)
                                    "
                                    class="text-sm border-[var(--border)] rounded-md shadow-sm focus:border-primary focus:ring-ring"
                                  >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                  </select>
                                }
                              </td>
                              <td
                                class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                              >
                                <button
                                  (click)="onRemoveMember(member)"
                                  class="text-red-600 hover:text-red-900"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>

                    @if (members().length === 0) {
                      <div
                        class="px-6 py-8 text-center text-[var(--muted-foreground)]"
                      >
                        No members found
                      </div>
                    }
                  </div>

                  <!-- Positions -->
                  <app-position-list
                    [projectId]="projectId"
                    [boardMembers]="members()"
                  />
                </div>
              </p-tabpanel>

              <!-- Tab 3: Automations -->
              <p-tabpanel [value]="3">
                <div class="py-6">
                  @defer {
                    <app-automation-rules [projectId]="projectId" />
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
                    <app-custom-fields-manager [projectId]="projectId" />
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
                    <app-milestone-list [projectId]="projectId" />
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
                      <app-share-settings [projectId]="projectId" />
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
                      <app-webhook-settings [projectId]="projectId" />
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
                            Export Project
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
                              Archive Project
                            </h3>
                            <p class="text-sm text-[var(--muted-foreground)]">
                              Hide this project from the sidebar. It can be
                              restored later from the Archived section.
                            </p>
                          </div>
                          <button
                            (click)="onArchiveProject()"
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
                              Archive Project
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  @if (canDeleteProject()) {
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
                                Delete Project
                              </h3>
                              <p class="text-sm text-[var(--muted-foreground)]">
                                Permanently delete this project and all its tasks.
                                This action cannot be undone.
                              </p>
                            </div>
                            <button
                              (click)="onDeleteProject()"
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
                                Delete Project
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  }
                </div>
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

    <!-- Invite Member Dialog (PrimeNG) -->
    <app-board-invite-member-dialog
      [(visible)]="showInviteDialog"
      [projectId]="projectId"
      [boardName]="project()?.name || ''"
      (invited)="onInviteResult($event)"
    />
    <p-confirmDialog />
    <app-save-template-dialog
      [(visible)]="showSaveTemplateDialog"
      [projectId]="projectId"
      [boardName]="project()?.name || ''"
      (saved)="onTemplateSaved()"
    />
    <app-import-dialog
      [(visible)]="showImportDialog"
      [projectId]="projectId"
      [boardName]="project()?.name || ''"
    />
    <app-export-dialog
      [(visible)]="showExportDialog"
      [projectId]="projectId"
      [boardName]="project()?.name || ''"
    />
    <p-toast />
  `,
})
export class BoardSettingsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private archiveService = inject(ArchiveService);
  private destroyRef = inject(DestroyRef);

  workspaceId = '';
  projectId = '';

  loading = signal(true);
  saving = signal(false);
  deleting = signal(false);
  archiving = signal(false);
  project = signal<Project | null>(null);
  members = signal<ProjectMember[]>([]);
  selectedColor = signal<string | null>(null);
  showInviteDialog = signal(false);
  showSaveTemplateDialog = signal(false);
  showImportDialog = signal(false);
  showExportDialog = signal(false);
  errorMessage = signal<string | null>(null);
  activeTab = signal(0);

  readonly presetColors = [
    '#6366f1',
    '#3b82f6',
    '#06b6d4',
    '#22c55e',
    '#eab308',
    '#f97316',
    '#f43f5e',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#84cc16',
    '#a855f7',
    '#ef4444',
    '#0ea5e9',
    '#10b981',
    '#f59e0b',
  ];

  readonly presetGradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    'linear-gradient(135deg, #2af598 0%, #009efd 100%)',
  ];

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.projectId = params['projectId'];
      this.loadProject();
    });

    // Support ?tab=N query param to open specific tab
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((queryParams) => {
      const tabParam = queryParams['tab'];
      if (tabParam !== undefined && tabParam !== null) {
        const tabIndex = parseInt(tabParam, 10);
        if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 8) {
          this.activeTab.set(tabIndex);
        }
      }
    });
  }

  onTabChange(tabValue: unknown): void {
    const value = tabValue as number;
    this.activeTab.set(value);
  }

  canDeleteProject(): boolean {
    // For now, any user can delete. In production, check role
    return !!this.authService.currentUser();
  }

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  onSave(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    const { name, description } = this.form.value;

    this.projectService
      .updateProject(this.projectId, { name, description })
      .subscribe({
        next: (updated) => {
          this.project.set(updated);
          this.form.markAsPristine();
          this.saving.set(false);
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }

  onInviteMember(): void {
    this.showInviteDialog.set(true);
  }

  onInviteResult(result: InviteMemberDialogResult): void {
    const snapshot = this.members();

    // Optimistic: insert temp member
    const tempMember: ProjectMember = {
      user_id: crypto.randomUUID(),
      project_id: this.projectId,
      role: result.role,
      name: result.email,
      email: result.email,
      avatar_url: null,
    };
    this.members.update((members) => [...members, tempMember]);

    this.projectService
      .inviteProjectMember(this.projectId, {
        email: result.email,
        role: result.role,
      })
      .subscribe({
        next: (member) => {
          this.members.update((members) =>
            members.map((m) => (m.user_id === tempMember.user_id ? member : m)),
          );
        },
        error: () => {
          this.members.set(snapshot);
          this.showError('Failed to invite member');
        },
      });
  }

  onMemberRoleChange(member: ProjectMember, role: 'viewer' | 'editor'): void {
    const snapshot = this.members();

    // Optimistic: update role locally
    this.members.update((members) =>
      members.map((m) => (m.user_id === member.user_id ? { ...m, role } : m)),
    );

    this.projectService
      .updateProjectMemberRole(this.projectId, member.user_id, { role })
      .subscribe({
        next: (updatedMember) => {
          this.members.update((members) =>
            members.map((m) =>
              m.user_id === updatedMember.user_id ? updatedMember : m,
            ),
          );
        },
        error: () => {
          this.members.set(snapshot);
          this.showError('Failed to update member role');
        },
      });
  }

  onRemoveMember(member: ProjectMember): void {
    this.confirmationService.confirm({
      message: `Remove ${member.name || member.email} from this project?`,
      header: 'Remove Member',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        const snapshot = this.members();

        // Optimistic: remove immediately
        this.members.update((members) =>
          members.filter((m) => m.user_id !== member.user_id),
        );

        this.projectService
          .removeProjectMember(this.projectId, member.user_id)
          .subscribe({
            error: () => {
              this.members.set(snapshot);
              this.showError('Failed to remove member');
            },
          });
      },
    });
  }

  onDeleteProject(): void {
    const proj = this.project();
    if (!proj) return;

    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${proj.name}"? This action cannot be undone. All tasks, columns, and data will be permanently lost.`,
      header: 'Delete Project',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.deleting.set(true);

        this.projectService.deleteProject(this.projectId).subscribe({
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

  selectBoardColor(color: string): void {
    this.selectedColor.set(color);
    this.projectService
      .updateProject(this.projectId, { background_color: color })
      .subscribe({
        next: (updated) => {
          this.project.set(updated);
          this.messageService.add({
            severity: 'success',
            summary: 'Color Updated',
            detail: 'Project color has been updated.',
            life: 2000,
          });
        },
        error: () => this.showError('Failed to update project color'),
      });
  }

  clearProjectColor(): void {
    this.selectedColor.set(null);
    this.projectService
      .updateProject(this.projectId, { background_color: null })
      .subscribe({
        next: (updated) => {
          this.project.set(updated);
          this.messageService.add({
            severity: 'success',
            summary: 'Color Cleared',
            detail: 'Project color has been removed.',
            life: 2000,
          });
        },
        error: () => this.showError('Failed to clear project color'),
      });
  }

  onArchiveProject(): void {
    const proj = this.project();
    if (!proj) return;

    this.confirmationService.confirm({
      message: `Archive "${proj.name}"? It will be hidden from the sidebar but can be restored later.`,
      header: 'Archive Project',
      icon: 'pi pi-inbox',
      acceptButtonStyleClass: 'p-button-warning p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => {
        this.archiving.set(true);
        this.projectService.deleteProject(this.projectId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Project Archived',
              detail: `"${proj.name}" has been archived.`,
              life: 4000,
            });
            this.router.navigate(['/workspace', this.workspaceId]);
          },
          error: () => {
            this.archiving.set(false);
            this.showError('Failed to archive project');
          },
        });
      },
    });
  }

  onTemplateSaved(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Template Saved',
      detail: 'Project saved as template successfully.',
      life: 3000,
    });
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }

  private loadProject(): void {
    this.loading.set(true);

    this.projectService.getProject(this.projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        this.selectedColor.set(proj.background_color ?? null);
        this.form.patchValue({
          name: proj.name,
          description: proj.description || '',
        });
        this.loadProjectMembers();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadProjectMembers(): void {
    this.projectService.getProjectMembers(this.projectId).subscribe({
      next: (members) => {
        this.members.set(members);
      },
      error: () => {
        // Error handling - failed to load members
      },
    });
  }
}

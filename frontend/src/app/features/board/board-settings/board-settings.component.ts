import {
  Component,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
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
  BoardService,
  Board,
  BoardMember,
} from '../../../core/services/board.service';
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
              [routerLink]="['/workspace', workspaceId, 'board', boardId]"
              class="hover:text-primary"
              >Back to Board</a
            >
          </nav>
          <h1 class="text-3xl font-bold text-[var(--foreground)]">
            Board Settings
          </h1>
          <p class="mt-2 text-[var(--muted-foreground)]">
            Configure your board's settings, columns, members, and integrations
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
              <p-tab [value]="4">Custom Fields</p-tab>
              <p-tab [value]="5">Milestones</p-tab>
              <p-tab [value]="6">Integrations</p-tab>
              <p-tab [value]="7">Advanced</p-tab>
            </p-tablist>
            <p-tabpanels>
              <!-- Tab 0: General -->
              <p-tabpanel [value]="0">
                <div class="py-6 space-y-8">
                  <!-- General Settings -->
                  <section class="animate-fade-in-up">
                    <div class="bg-[var(--card)] shadow rounded-lg">
                      <div class="px-6 py-4 border-b border-[var(--border)]">
                        <h2 class="text-lg font-medium text-[var(--foreground)]">
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
                            <p class="mt-1 text-sm text-red-600">Name is required</p>
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
                            placeholder="Add a description for this board..."
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

                  <!-- Board Color -->
                  <section class="animate-fade-in-up">
                    <div class="bg-[var(--card)] shadow rounded-lg">
                      <div class="px-6 py-4 border-b border-[var(--border)]">
                        <h2 class="text-lg font-medium text-[var(--foreground)]">
                          Board Color
                        </h2>
                      </div>
                      <div class="px-6 py-4">
                        <p class="text-sm text-[var(--muted-foreground)] mb-3">
                          Choose a background color for this board.
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
                            (click)="clearBoardColor()"
                            title="Clear color"
                          >
                            <i class="pi pi-times text-xs"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <!-- Save as Template -->
                  <section class="animate-fade-in-up">
                    <div class="bg-[var(--card)] shadow rounded-lg">
                      <div class="px-6 py-4 border-b border-[var(--border)]">
                        <h2 class="text-lg font-medium text-[var(--foreground)]">
                          Template
                        </h2>
                      </div>
                      <div class="px-6 py-4">
                        <div class="flex items-center justify-between">
                          <div>
                            <h3 class="text-sm font-medium text-[var(--foreground)]">
                              Save Board as Template
                            </h3>
                            <p class="text-sm text-[var(--muted-foreground)]">
                              Save this board's structure as a reusable template including all columns and tasks.
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
                  <app-column-manager [boardId]="boardId"></app-column-manager>
                </div>
              </p-tabpanel>

              <!-- Tab 2: Members -->
              <p-tabpanel [value]="2">
                <div class="py-6 space-y-6">
                  <!-- Members Table -->
                  <div class="bg-[var(--card)] shadow rounded-lg">
                    <div class="px-6 py-4 border-b border-[var(--border)]">
                      <div class="flex items-center justify-between">
                        <h3 class="text-lg font-medium text-[var(--foreground)]">
                          Board Members
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
                                      {{ getInitials(member.name || member.email) }}
                                    }
                                  </div>
                                  <div>
                                    <p
                                      class="text-sm font-medium text-[var(--foreground)]"
                                    >
                                      {{ member.name || 'Unknown' }}
                                    </p>
                                    <p class="text-sm text-[var(--muted-foreground)]">
                                      {{ member.email }}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td class="px-6 py-4 whitespace-nowrap">
                                @if (member.role === 'owner') {
                                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    Owner
                                  </span>
                                } @else {
                                  <select
                                    [ngModel]="member.role"
                                    (ngModelChange)="onMemberRoleChange(member, $event)"
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
                  <app-position-list [boardId]="boardId" [boardMembers]="members()" />
                </div>
              </p-tabpanel>

              <!-- Tab 3: Automations -->
              <p-tabpanel [value]="3">
                <div class="py-6">
                  @defer {
                    <app-automation-rules [boardId]="boardId" />
                  } @placeholder {
                    <div class="flex items-center justify-center py-12">
                      <svg class="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 4: Custom Fields -->
              <p-tabpanel [value]="4">
                <div class="py-6">
                  @defer {
                    <app-custom-fields-manager [boardId]="boardId" />
                  } @placeholder {
                    <div class="flex items-center justify-center py-12">
                      <svg class="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 5: Milestones -->
              <p-tabpanel [value]="5">
                <div class="py-6">
                  @defer {
                    <app-milestone-list [boardId]="boardId" />
                  } @placeholder {
                    <div class="flex items-center justify-center py-12">
                      <svg class="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 6: Integrations -->
              <p-tabpanel [value]="6">
                <div class="py-6 space-y-8">
                  <!-- Share Settings -->
                  @defer {
                    <section>
                      <app-share-settings [boardId]="boardId" />
                    </section>
                  } @placeholder {
                    <div class="flex items-center justify-center py-8">
                      <svg class="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                      <svg class="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                          <h3 class="text-sm font-medium text-[var(--foreground)]">
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
                          <h3 class="text-sm font-medium text-[var(--foreground)]">
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

              <!-- Tab 7: Advanced (Danger Zone) -->
              <p-tabpanel [value]="7">
                <div class="py-6 space-y-6">
                  <!-- Archive Board -->
                  <section>
                    <div class="bg-[var(--card)] shadow rounded-lg">
                      <div class="px-6 py-4 border-b border-[var(--border)]">
                        <h2 class="text-lg font-medium text-[var(--foreground)]">
                          Archive
                        </h2>
                      </div>
                      <div class="px-6 py-4">
                        <div class="flex items-center justify-between">
                          <div>
                            <h3 class="text-sm font-medium text-[var(--foreground)]">
                              Archive Board
                            </h3>
                            <p class="text-sm text-[var(--muted-foreground)]">
                              Hide this board from the sidebar. It can be restored later from the Archived section.
                            </p>
                          </div>
                          <button
                            (click)="onArchiveBoard()"
                            [disabled]="archiving()"
                            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-50 transition-colors disabled:opacity-50"
                          >
                            @if (archiving()) {
                              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                              <h3 class="text-sm font-medium text-[var(--foreground)]">
                                Delete Board
                              </h3>
                              <p class="text-sm text-[var(--muted-foreground)]">
                                Permanently delete this board and all its tasks. This
                                action cannot be undone.
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
            </p-tabpanels>
          </p-tabs>
        } @else {
          <div class="text-center py-12">
            <p class="text-[var(--muted-foreground)]">Board not found</p>
          </div>
        }
      </div>
    </div>

    <!-- Invite Member Dialog (PrimeNG) -->
    <app-board-invite-member-dialog
      [(visible)]="showInviteDialog"
      [boardId]="boardId"
      [boardName]="board()?.name || ''"
      (invited)="onInviteResult($event)"
    />
    <p-confirmDialog />
    <app-save-template-dialog
      [(visible)]="showSaveTemplateDialog"
      [boardId]="boardId"
      [boardName]="board()?.name || ''"
      (saved)="onTemplateSaved()"
    />
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
export class BoardSettingsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private boardService = inject(BoardService);
  private authService = inject(AuthService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private archiveService = inject(ArchiveService);

  workspaceId = '';
  boardId = '';

  loading = signal(true);
  saving = signal(false);
  deleting = signal(false);
  archiving = signal(false);
  board = signal<Board | null>(null);
  members = signal<BoardMember[]>([]);
  selectedColor = signal<string | null>(null);
  showInviteDialog = signal(false);
  showSaveTemplateDialog = signal(false);
  showImportDialog = signal(false);
  showExportDialog = signal(false);
  errorMessage = signal<string | null>(null);
  activeTab = signal(0);

  readonly presetColors = [
    '#6366f1', '#3b82f6', '#06b6d4', '#22c55e',
    '#eab308', '#f97316', '#f43f5e', '#8b5cf6',
    '#ec4899', '#14b8a6', '#84cc16', '#a855f7',
    '#ef4444', '#0ea5e9', '#10b981', '#f59e0b',
  ];

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.boardId = params['boardId'];
      this.loadBoard();
    });

    // Support ?tab=N query param to open specific tab
    this.route.queryParams.subscribe((queryParams) => {
      const tabParam = queryParams['tab'];
      if (tabParam !== undefined && tabParam !== null) {
        const tabIndex = parseInt(tabParam, 10);
        if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 7) {
          this.activeTab.set(tabIndex);
        }
      }
    });
  }

  onTabChange(tabValue: unknown): void {
    const value = tabValue as number;
    this.activeTab.set(value);
  }

  canDeleteBoard(): boolean {
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

    this.boardService
      .updateBoard(this.boardId, { name, description })
      .subscribe({
        next: (updated) => {
          this.board.set(updated);
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
    const tempMember: BoardMember = {
      user_id: crypto.randomUUID(),
      board_id: this.boardId,
      role: result.role,
      name: result.email,
      email: result.email,
      avatar_url: null,
    };
    this.members.update((members) => [...members, tempMember]);

    this.boardService
      .inviteBoardMember(this.boardId, {
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

  onMemberRoleChange(member: BoardMember, role: 'viewer' | 'editor'): void {
    const snapshot = this.members();

    // Optimistic: update role locally
    this.members.update((members) =>
      members.map((m) => (m.user_id === member.user_id ? { ...m, role } : m)),
    );

    this.boardService
      .updateBoardMemberRole(this.boardId, member.user_id, { role })
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

  onRemoveMember(member: BoardMember): void {
    this.confirmationService.confirm({
      message: `Remove ${member.name || member.email} from this board?`,
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

        this.boardService
          .removeBoardMember(this.boardId, member.user_id)
          .subscribe({
            error: () => {
              this.members.set(snapshot);
              this.showError('Failed to remove member');
            },
          });
      },
    });
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

        this.boardService.deleteBoard(this.boardId).subscribe({
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
    this.boardService
      .updateBoard(this.boardId, { background_color: color })
      .subscribe({
        next: (updated) => {
          this.board.set(updated);
          this.messageService.add({
            severity: 'success',
            summary: 'Color Updated',
            detail: 'Board color has been updated.',
            life: 2000,
          });
        },
        error: () => this.showError('Failed to update board color'),
      });
  }

  clearBoardColor(): void {
    this.selectedColor.set(null);
    this.boardService
      .updateBoard(this.boardId, { background_color: null })
      .subscribe({
        next: (updated) => {
          this.board.set(updated);
          this.messageService.add({
            severity: 'success',
            summary: 'Color Cleared',
            detail: 'Board color has been removed.',
            life: 2000,
          });
        },
        error: () => this.showError('Failed to clear board color'),
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
        this.boardService.deleteBoard(this.boardId).subscribe({
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

  onTemplateSaved(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Template Saved',
      detail: 'Board saved as template successfully.',
      life: 3000,
    });
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }

  private loadBoard(): void {
    this.loading.set(true);

    this.boardService.getBoard(this.boardId).subscribe({
      next: (board) => {
        this.board.set(board);
        this.selectedColor.set(board.background_color ?? null);
        this.form.patchValue({
          name: board.name,
          description: board.description || '',
        });
        this.loadBoardMembers();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadBoardMembers(): void {
    this.boardService.getBoardMembers(this.boardId).subscribe({
      next: (members) => {
        this.members.set(members);
      },
      error: () => {
        // Error handling - failed to load members
      },
    });
  }
}

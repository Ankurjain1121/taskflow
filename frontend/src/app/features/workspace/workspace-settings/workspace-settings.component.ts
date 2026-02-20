import {
  Component,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Tabs } from 'primeng/tabs';
import { TabList } from 'primeng/tabs';
import { TabPanels } from 'primeng/tabs';
import { TabPanel } from 'primeng/tabs';
import { Tab } from 'primeng/tabs';
import {
  WorkspaceService,
  Workspace,
  WorkspaceMember,
} from '../../../core/services/workspace.service';
import { BoardService } from '../../../core/services/board.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  ApiKeyService,
  ApiKeyListItem,
} from '../../../core/services/api-key.service';
import { UploadService } from '../../../core/services/upload.service';
import {
  MembersListComponent,
  MemberWithDetails,
} from '../members-list/members-list.component';

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    MembersListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--background)]">
      <div class="max-w-4xl mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-[var(--foreground)]">
            Workspace Settings
          </h1>
          <p class="mt-2 text-[var(--muted-foreground)]">
            Manage your workspace settings and members
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
        } @else if (workspace()) {
          <p-tabs [value]="0">
            <p-tablist>
              <p-tab [value]="0">General</p-tab>
              <p-tab [value]="1">Members</p-tab>
              <p-tab [value]="2">Integrations</p-tab>
              <p-tab [value]="3">Advanced</p-tab>
            </p-tablist>
            <p-tabpanels>
              <!-- Tab 1: General -->
              <p-tabpanel [value]="0">
                <div class="py-6 space-y-6">
                  <!-- Logo Upload -->
                  <div class="widget-card p-6">
                    <h3
                      class="text-sm font-medium text-[var(--foreground)] mb-4"
                    >
                      Workspace Logo
                    </h3>
                    <div class="flex items-center gap-6">
                      <div
                        class="w-20 h-20 rounded-lg bg-[var(--muted)] flex items-center justify-center text-2xl font-bold text-[var(--muted-foreground)] overflow-hidden border-2 border-dashed border-[var(--border)]"
                      >
                        @if (logoPreview() || workspace()?.logo_url) {
                          <img
                            [src]="logoPreview() || workspace()?.logo_url"
                            alt="Workspace logo"
                            class="w-full h-full object-cover"
                          />
                        } @else {
                          {{ workspace()?.name?.charAt(0)?.toUpperCase() }}
                        }
                      </div>
                      <div>
                        <button
                          (click)="logoInput.click()"
                          [disabled]="uploadingLogo()"
                          class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 disabled:opacity-50"
                        >
                          @if (uploadingLogo()) {
                            Uploading...
                          } @else {
                            Change Logo
                          }
                        </button>
                        <input
                          #logoInput
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          (change)="onLogoSelected($event)"
                          class="hidden"
                        />
                        <p class="mt-1 text-xs text-[var(--muted-foreground)]">
                          PNG, JPG, or WebP. Max 2MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Name & Description -->
                  <div class="widget-card">
                    <div class="px-6 py-4 border-b border-[var(--border)]">
                      <h3 class="text-sm font-medium text-[var(--foreground)]">
                        General Information
                      </h3>
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
                          class="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
                        />
                        @if (
                          form.controls['name'].invalid &&
                          form.controls['name'].touched
                        ) {
                          <p class="mt-1 text-sm text-[var(--status-red-text)]">
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
                          placeholder="Describe what this workspace is for..."
                          class="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 shadow-sm focus:border-primary focus:ring-ring sm:text-sm placeholder:text-[var(--muted-foreground)]"
                        ></textarea>
                      </div>

                      <div class="flex justify-end pt-4">
                        <button
                          type="submit"
                          [disabled]="saving() || form.invalid || !form.dirty"
                          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
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

                  <!-- Danger Zone -->
                  @if (isAdmin()) {
                    <div
                      class="widget-card border-2 border-[var(--status-red-border)]"
                    >
                      <div
                        class="px-6 py-4 border-b border-[var(--status-red-border)] bg-[var(--status-red-bg)]"
                      >
                        <h3
                          class="text-sm font-medium text-[var(--status-red-text)]"
                        >
                          Danger Zone
                        </h3>
                      </div>
                      <div class="px-6 py-4">
                        <div class="flex items-center justify-between">
                          <div>
                            <h4
                              class="text-sm font-medium text-[var(--foreground)]"
                            >
                              Delete Workspace
                            </h4>
                            <p class="text-sm text-[var(--muted-foreground)]">
                              Permanently delete this workspace and all its
                              data. This action cannot be undone.
                            </p>
                          </div>
                          <button
                            (click)="onDeleteWorkspace()"
                            [disabled]="deleting()"
                            class="inline-flex items-center px-4 py-2 border border-[var(--status-red-border)] text-sm font-medium rounded-md text-[var(--status-red-text)] bg-[var(--card)] hover:bg-[var(--status-red-bg)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                          >
                            @if (deleting()) {
                              Deleting...
                            } @else {
                              Delete Workspace
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </p-tabpanel>

              <!-- Tab 2: Members -->
              <p-tabpanel [value]="1">
                <div class="py-6">
                  <app-members-list
                    [members]="members()"
                    [workspaceId]="workspaceId"
                    [workspaceName]="workspace()?.name ?? 'this workspace'"
                    [boards]="boards()"
                    (memberRemoved)="onMemberRemoved($event)"
                  ></app-members-list>
                </div>
              </p-tabpanel>

              <!-- Tab 3: Integrations -->
              <p-tabpanel [value]="2">
                <div class="py-6 space-y-6">
                  <!-- API Keys -->
                  <div class="widget-card">
                    <div class="px-6 py-4 border-b border-[var(--border)]">
                      <div class="flex items-center justify-between">
                        <div>
                          <h3
                            class="text-sm font-medium text-[var(--foreground)]"
                          >
                            API Keys
                          </h3>
                          <p
                            class="text-xs text-[var(--muted-foreground)] mt-1"
                          >
                            Manage API keys for programmatic access
                          </p>
                        </div>
                        <button
                          (click)="onGenerateApiKey()"
                          [disabled]="generatingKey()"
                          class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:brightness-90 disabled:opacity-50"
                        >
                          @if (generatingKey()) {
                            Generating...
                          } @else {
                            Generate New Key
                          }
                        </button>
                      </div>
                    </div>

                    <!-- Newly created key display -->
                    @if (newlyCreatedKey()) {
                      <div
                        class="mx-6 mt-4 p-4 bg-[var(--status-green-bg)] border border-[var(--status-green-border)] rounded-lg"
                      >
                        <div class="flex items-center justify-between mb-2">
                          <p
                            class="text-sm font-medium text-[var(--status-green-text)]"
                          >
                            API Key Created - Copy it now! It won't be shown
                            again.
                          </p>
                          <button
                            (click)="newlyCreatedKey.set(null)"
                            class="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                        <div class="flex items-center gap-2">
                          <code
                            class="flex-1 px-3 py-2 bg-[var(--background)] rounded text-sm font-mono text-[var(--foreground)] select-all break-all"
                          >
                            {{ newlyCreatedKey() }}
                          </code>
                          <button
                            (click)="copyApiKey()"
                            class="inline-flex items-center px-3 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10"
                          >
                            {{ copiedKey() ? 'Copied!' : 'Copy' }}
                          </button>
                        </div>
                      </div>
                    }

                    <!-- API Keys Table -->
                    @if (apiKeys().length > 0) {
                      <div class="overflow-x-auto">
                        <table
                          class="min-w-full divide-y divide-[var(--border)]"
                        >
                          <thead class="bg-[var(--secondary)]">
                            <tr>
                              <th
                                class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                              >
                                Name
                              </th>
                              <th
                                class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                              >
                                Key Prefix
                              </th>
                              <th
                                class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                              >
                                Created
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
                            @for (key of apiKeys(); track key.id) {
                              <tr class="hover:bg-[var(--muted)]">
                                <td
                                  class="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--foreground)]"
                                >
                                  {{ key.name }}
                                </td>
                                <td
                                  class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)] font-mono"
                                >
                                  {{ key.key_prefix }}...
                                </td>
                                <td
                                  class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)]"
                                >
                                  {{ formatDate(key.created_at) }}
                                </td>
                                <td
                                  class="px-6 py-4 whitespace-nowrap text-right"
                                >
                                  <button
                                    (click)="onRevokeApiKey(key)"
                                    [disabled]="revokingKey() === key.id"
                                    class="text-sm text-red-600 hover:text-red-900 disabled:opacity-50"
                                  >
                                    {{
                                      revokingKey() === key.id
                                        ? 'Revoking...'
                                        : 'Revoke'
                                    }}
                                  </button>
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    } @else {
                      <div
                        class="px-6 py-8 text-center text-[var(--muted-foreground)] text-sm"
                      >
                        No API keys yet. Generate one to get started.
                      </div>
                    }
                  </div>

                  <!-- Integration Placeholders -->
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    @for (
                      integration of integrationPlaceholders;
                      track integration.name
                    ) {
                      <div class="widget-card p-5">
                        <div class="flex items-center gap-3 mb-3">
                          <div
                            class="w-10 h-10 rounded-lg bg-[var(--secondary)] flex items-center justify-center"
                          >
                            <svg
                              class="w-5 h-5 text-[var(--muted-foreground)]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                              />
                            </svg>
                          </div>
                          <div>
                            <h4
                              class="text-sm font-medium text-[var(--foreground)]"
                            >
                              {{ integration.name }}
                            </h4>
                            <span
                              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]"
                            >
                              Coming soon
                            </span>
                          </div>
                        </div>
                        <p class="text-xs text-[var(--muted-foreground)]">
                          {{ integration.description }}
                        </p>
                      </div>
                    }
                  </div>
                </div>
              </p-tabpanel>

              <!-- Tab 4: Advanced -->
              <p-tabpanel [value]="3">
                <div class="py-6 space-y-6">
                  <!-- Export -->
                  <div class="widget-card p-6">
                    <div class="flex items-center justify-between">
                      <div>
                        <h3
                          class="text-sm font-medium text-[var(--foreground)]"
                        >
                          Export Workspace Data
                        </h3>
                        <p class="text-xs text-[var(--muted-foreground)] mt-1">
                          Download all workspace data as a JSON file
                        </p>
                      </div>
                      <button
                        (click)="onExportWorkspace()"
                        [disabled]="exporting()"
                        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)] disabled:opacity-50"
                      >
                        @if (exporting()) {
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
                          Exporting...
                        } @else {
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
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          Export JSON
                        }
                      </button>
                    </div>
                  </div>

                  <!-- Coming Soon placeholders -->
                  @for (section of advancedPlaceholders; track section.title) {
                    <div class="widget-card p-6 opacity-60">
                      <div class="flex items-center justify-between">
                        <div>
                          <h3
                            class="text-sm font-medium text-[var(--foreground)]"
                          >
                            {{ section.title }}
                          </h3>
                          <p
                            class="text-xs text-[var(--muted-foreground)] mt-1"
                          >
                            {{ section.description }}
                          </p>
                        </div>
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]"
                        >
                          Coming soon
                        </span>
                      </div>
                    </div>
                  }
                </div>
              </p-tabpanel>
            </p-tabpanels>
          </p-tabs>
        } @else {
          <div class="text-center py-12">
            <p class="text-[var(--muted-foreground)]">Workspace not found</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class WorkspaceSettingsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private workspaceService = inject(WorkspaceService);
  private boardService = inject(BoardService);
  private authService = inject(AuthService);
  private apiKeyService = inject(ApiKeyService);
  private uploadService = inject(UploadService);

  workspaceId = '';

  loading = signal(true);
  saving = signal(false);
  deleting = signal(false);
  workspace = signal<Workspace | null>(null);
  members = signal<MemberWithDetails[]>([]);
  boards = signal<{ id: string; name: string }[]>([]);

  // Logo
  logoPreview = signal<string | null>(null);
  uploadingLogo = signal(false);

  // API Keys
  apiKeys = signal<ApiKeyListItem[]>([]);
  generatingKey = signal(false);
  newlyCreatedKey = signal<string | null>(null);
  copiedKey = signal(false);
  revokingKey = signal<string | null>(null);

  // Export
  exporting = signal(false);

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  integrationPlaceholders = [
    {
      name: 'Slack',
      description: 'Get notifications and updates in your Slack channels',
    },
    { name: 'GitHub', description: 'Link pull requests and commits to tasks' },
    { name: 'Jira', description: 'Import and sync issues from Jira projects' },
  ];

  advancedPlaceholders = [
    {
      title: 'Default Board Settings',
      description:
        'Configure default columns, labels, and automation rules for new boards',
    },
    {
      title: 'Custom Field Definitions',
      description:
        'Define custom fields that can be used across all boards in this workspace',
    },
    {
      title: 'Automation Defaults',
      description: 'Set up default automation rules that apply to all boards',
    },
  ];

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.loadWorkspace();
    });
  }

  isAdmin(): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    const member = this.members().find((m) => m.user_id === user.id);
    return member?.role === 'owner' || member?.role === 'admin';
  }

  onSave(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    const { name, description } = this.form.value;

    this.workspaceService
      .update(this.workspaceId, { name, description })
      .subscribe({
        next: (updated) => {
          this.workspace.set(updated);
          this.form.markAsPristine();
          this.saving.set(false);
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }

  onDeleteWorkspace(): void {
    const workspace = this.workspace();
    if (!workspace) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${workspace.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    const doubleConfirmed = confirm(
      `Type the workspace name to confirm: ${workspace.name}`,
    );
    if (!doubleConfirmed) return;

    this.deleting.set(true);

    this.workspaceService.delete(this.workspaceId).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.deleting.set(false);
      },
    });
  }

  onMemberRemoved(userId: string): void {
    this.members.update((members) =>
      members.filter((m) => m.user_id !== userId),
    );
  }

  // Logo upload
  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be under 2MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    this.uploadingLogo.set(true);
    this.uploadService
      .getLogoUploadUrl(this.workspaceId, file.name, file.size, file.type)
      .subscribe({
        next: (presigned) => {
          this.uploadService
            .uploadFileToPresignedUrl(presigned.upload_url, file)
            .subscribe({
              next: () => {
                this.uploadService
                  .confirmLogoUpload(this.workspaceId, presigned.storage_key)
                  .subscribe({
                    next: (result) => {
                      this.workspace.update((ws) =>
                        ws ? { ...ws, logo_url: result.logo_url } : ws,
                      );
                      this.logoPreview.set(null);
                      this.uploadingLogo.set(false);
                    },
                    error: () => {
                      this.uploadingLogo.set(false);
                    },
                  });
              },
              error: () => {
                this.uploadingLogo.set(false);
              },
            });
        },
        error: () => {
          this.uploadingLogo.set(false);
        },
      });

    // Reset input
    input.value = '';
  }

  // API Keys
  onGenerateApiKey(): void {
    const name = prompt('Enter a name for this API key:');
    if (!name) return;

    this.generatingKey.set(true);
    this.apiKeyService.createKey(this.workspaceId, name).subscribe({
      next: (response) => {
        this.newlyCreatedKey.set(response.full_key);
        this.loadApiKeys();
        this.generatingKey.set(false);
      },
      error: () => {
        this.generatingKey.set(false);
      },
    });
  }

  copyApiKey(): void {
    const key = this.newlyCreatedKey();
    if (!key) return;

    navigator.clipboard.writeText(key).then(() => {
      this.copiedKey.set(true);
      setTimeout(() => this.copiedKey.set(false), 2000);
    });
  }

  onRevokeApiKey(key: ApiKeyListItem): void {
    if (!confirm(`Revoke API key "${key.name}"? This cannot be undone.`))
      return;

    this.revokingKey.set(key.id);
    this.apiKeyService.revokeKey(this.workspaceId, key.id).subscribe({
      next: () => {
        this.apiKeys.update((keys) => keys.filter((k) => k.id !== key.id));
        this.revokingKey.set(null);
      },
      error: () => {
        this.revokingKey.set(null);
      },
    });
  }

  // Export
  onExportWorkspace(): void {
    this.exporting.set(true);
    this.http
      .get(`/api/workspaces/${this.workspaceId}/export`, {
        params: { format: 'json' },
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `workspace-${this.workspace()?.name || this.workspaceId}.json`;
          a.click();
          URL.revokeObjectURL(url);
          this.exporting.set(false);
        },
        error: () => {
          this.exporting.set(false);
        },
      });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private loadWorkspace(): void {
    this.loading.set(true);

    this.workspaceService.get(this.workspaceId).subscribe({
      next: (workspace) => {
        this.workspace.set(workspace);
        this.form.patchValue({
          name: workspace.name,
          description: workspace.description || '',
        });
        this.loadMembers();
        this.loadBoards();
        this.loadApiKeys();
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadMembers(): void {
    this.workspaceService.getMembers(this.workspaceId).subscribe({
      next: (members) => {
        this.members.set(
          members.map((m) => ({
            ...m,
            workspace_id: this.workspaceId,
            role: m.role as WorkspaceMember['role'],
            display_name: m.name,
            joined_at: m.joined_at || new Date().toISOString(),
          })),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadBoards(): void {
    this.boardService.listBoards(this.workspaceId).subscribe({
      next: (boards) => {
        this.boards.set(boards.map((b) => ({ id: b.id, name: b.name })));
      },
      error: () => {
        // Non-critical, silently fail
      },
    });
  }

  private loadApiKeys(): void {
    this.apiKeyService.listKeys(this.workspaceId).subscribe({
      next: (keys) => {
        this.apiKeys.set(keys);
      },
      error: () => {
        // Non-critical
      },
    });
  }
}

import {
  Component,
  computed,
  DestroyRef,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import {
  MembersListComponent,
  MemberWithDetails,
} from '../members-list/members-list.component';
import { WorkspaceGeneralTabComponent } from './workspace-general-tab.component';
import { WorkspaceApiKeysTabComponent } from './workspace-api-keys-tab.component';
import { WorkspaceAdvancedTabComponent } from './workspace-advanced-tab.component';
import { TeamsListComponent } from '../teams/teams-list.component';
import { WorkspaceLabelsComponent } from '../labels/workspace-labels.component';
import { AuditLogComponent } from '../audit-log/audit-log.component';
import { TrashComponent } from '../trash/trash.component';
import { WorkspaceRolesTabComponent } from './workspace-roles-tab.component';

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [
    CommonModule,
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    MembersListComponent,
    WorkspaceGeneralTabComponent,
    WorkspaceApiKeysTabComponent,
    WorkspaceAdvancedTabComponent,
    TeamsListComponent,
    WorkspaceLabelsComponent,
    AuditLogComponent,
    TrashComponent,
    WorkspaceRolesTabComponent,
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
              <p-tab [value]="2">Roles</p-tab>
              <p-tab [value]="3">Teams</p-tab>
              <p-tab [value]="4">Labels</p-tab>
              <p-tab [value]="5">Audit Log</p-tab>
              <p-tab [value]="6">Trash</p-tab>
              <p-tab [value]="7">Integrations</p-tab>
              <p-tab [value]="8">Advanced</p-tab>
            </p-tablist>
            <p-tabpanels>
              <!-- Tab 0: General -->
              <p-tabpanel [value]="0">
                <app-workspace-general-tab
                  [workspace]="workspace()"
                  [workspaceId]="workspaceId"
                  [isAdmin]="isAdmin()"
                  (workspaceSaved)="onWorkspaceSaved($event)"
                  (deleteRequested)="onDeleteWorkspace()"
                />
              </p-tabpanel>

              <!-- Tab 1: Members -->
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

              <!-- Tab 2: Roles -->
              <p-tabpanel [value]="2">
                <app-workspace-roles-tab [workspaceId]="workspaceId" />
              </p-tabpanel>

              <!-- Tab 3: Teams -->
              <p-tabpanel [value]="3">
                <app-teams-list [workspaceId]="workspaceId" />
              </p-tabpanel>

              <!-- Tab 4: Labels -->
              <p-tabpanel [value]="4">
                <app-workspace-labels [workspaceId]="workspaceId" />
              </p-tabpanel>

              <!-- Tab 5: Audit Log -->
              <p-tabpanel [value]="5">
                <app-audit-log [workspaceId]="workspaceId" />
              </p-tabpanel>

              <!-- Tab 6: Trash -->
              <p-tabpanel [value]="6">
                <app-trash [workspaceId]="workspaceId" />
              </p-tabpanel>

              <!-- Tab 7: Integrations -->
              <p-tabpanel [value]="7">
                <app-workspace-api-keys-tab [workspaceId]="workspaceId" />
              </p-tabpanel>

              <!-- Tab 8: Advanced -->
              <p-tabpanel [value]="8">
                <app-workspace-advanced-tab
                  [workspace]="workspace()"
                  [workspaceId]="workspaceId"
                />
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
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private workspaceService = inject(WorkspaceService);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);
  readonly permissionService = inject(PermissionService);

  @ViewChild(WorkspaceGeneralTabComponent)
  generalTab?: WorkspaceGeneralTabComponent;

  workspaceId = '';

  loading = signal(true);
  workspace = signal<Workspace | null>(null);
  members = signal<MemberWithDetails[]>([]);
  boards = signal<{ id: string; name: string }[]>([]);

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.loadWorkspace();
    });
  }

  isAdmin = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.role === 'SuperAdmin') return true;
    const member = this.members().find((m) => m.user_id === user.id);
    return member?.role === 'owner' || member?.role === 'admin';
  });

  onWorkspaceSaved(updated: Workspace): void {
    this.workspace.set(updated);
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

    this.workspaceService.delete(this.workspaceId).subscribe({
      next: () => {
        // Workspace deleted — redirect to discover (can't use deleted workspace route)
        this.router.navigate(['/discover']);
      },
    });
  }

  onMemberRemoved(userId: string): void {
    this.members.update((members) =>
      members.filter((m) => m.user_id !== userId),
    );
  }

  private loadWorkspace(): void {
    this.loading.set(true);

    this.workspaceService.get(this.workspaceId).subscribe({
      next: (workspace) => {
        this.workspace.set(workspace);
        // Patch the general tab form after view init
        setTimeout(() => {
          this.generalTab?.patchForm(workspace);
        });
        // Extract members from workspace response (embedded by backend)
        const wsAny = workspace as unknown as Record<string, unknown>;
        const embeddedMembers = (wsAny['members'] ?? []) as Array<{
          user_id: string;
          name: string;
          email: string;
          avatar_url: string | null;
          job_title: string | null;
          department: string | null;
          role: string;
          joined_at: string;
        }>;
        this.members.set(
          embeddedMembers.map((m) => ({
            ...m,
            workspace_id: this.workspaceId,
            role: m.role.toLowerCase() as WorkspaceMember['role'],
            display_name: m.name,
            joined_at: m.joined_at || new Date().toISOString(),
          })),
        );
        this.loading.set(false);
        this.loadBoards();
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadBoards(): void {
    this.projectService.listBoards(this.workspaceId).subscribe({
      next: (boards) => {
        this.boards.set(boards.map((b) => ({ id: b.id, name: b.name })));
      },
      error: () => {
        // Non-critical, silently fail
      },
    });
  }
}

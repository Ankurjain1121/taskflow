import {
  Component,
  computed,
  signal,
  inject,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Dialog } from 'primeng/dialog';
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
import { WorkspaceSettingsDialogService } from '../../../core/services/workspace-settings-dialog.service';
import { WorkspaceGeneralTabComponent } from './workspace-general-tab.component';
import { WorkspaceApiKeysTabComponent } from './workspace-api-keys-tab.component';
import { WorkspaceAdvancedTabComponent } from './workspace-advanced-tab.component';

interface MemberInfo {
  user_id: string;
  role: WorkspaceMember['role'];
}

@Component({
  selector: 'app-workspace-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    Dialog,
    Tabs,
    TabList,
    TabPanels,
    TabPanel,
    Tab,
    WorkspaceGeneralTabComponent,
    WorkspaceApiKeysTabComponent,
    WorkspaceAdvancedTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Workspace Settings"
      [visible]="dialogService.visible()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [style]="{ width: '720px' }"
      [breakpoints]="{ '768px': '95vw' }"
      [draggable]="false"
      (onShow)="onDialogShow()"
      (onHide)="onDialogHide()"
    >
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
            <p-tab [value]="1">Integrations</p-tab>
            <p-tab [value]="2">Advanced</p-tab>
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel [value]="0">
              <app-workspace-general-tab
                [workspace]="workspace()"
                [workspaceId]="dialogService.workspaceId()"
                [isAdmin]="isAdmin()"
                (workspaceSaved)="onWorkspaceSaved($event)"
                (deleteRequested)="onDeleteWorkspace()"
              />
            </p-tabpanel>
            <p-tabpanel [value]="1">
              <app-workspace-api-keys-tab
                [workspaceId]="dialogService.workspaceId()"
              />
            </p-tabpanel>
            <p-tabpanel [value]="2">
              <app-workspace-advanced-tab
                [workspace]="workspace()"
                [workspaceId]="dialogService.workspaceId()"
              />
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      } @else {
        <div class="text-center py-12">
          <p class="text-[var(--muted-foreground)]">Workspace not found</p>
        </div>
      }
    </p-dialog>
  `,
})
export class WorkspaceSettingsDialogComponent {
  readonly dialogService = inject(WorkspaceSettingsDialogService);
  private router = inject(Router);
  private workspaceService = inject(WorkspaceService);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);

  @ViewChild(WorkspaceGeneralTabComponent)
  generalTab?: WorkspaceGeneralTabComponent;

  loading = signal(true);
  workspace = signal<Workspace | null>(null);
  members = signal<MemberInfo[]>([]);

  isAdmin = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    const member = this.members().find((m) => m.user_id === user.id);
    return member?.role === 'owner' || member?.role === 'admin';
  });

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.dialogService.close();
    }
  }

  onDialogShow(): void {
    this.loadWorkspace();
  }

  onDialogHide(): void {
    this.workspace.set(null);
    this.members.set([]);
    this.loading.set(true);
  }

  onWorkspaceSaved(updated: Workspace): void {
    this.workspace.set(updated);
  }

  onDeleteWorkspace(): void {
    const ws = this.workspace();
    if (!ws) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${ws.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    const doubleConfirmed = confirm(
      `Type the workspace name to confirm: ${ws.name}`,
    );
    if (!doubleConfirmed) return;

    const wsId = this.dialogService.workspaceId();
    this.workspaceService.delete(wsId).subscribe({
      next: () => {
        this.dialogService.close();
        this.router.navigate(['/dashboard']);
      },
    });
  }

  private loadWorkspace(): void {
    this.loading.set(true);
    const wsId = this.dialogService.workspaceId();

    this.workspaceService.get(wsId).subscribe({
      next: (workspace) => {
        this.workspace.set(workspace);
        setTimeout(() => {
          this.generalTab?.patchForm(workspace);
        });
        // Extract members from workspace response (embedded by backend)
        const wsAny = workspace as unknown as Record<string, unknown>;
        const embeddedMembers = (wsAny['members'] ?? []) as Array<{
          user_id: string;
          role: string;
        }>;
        this.members.set(
          embeddedMembers.map((m) => ({
            user_id: m.user_id,
            role: m.role.toLowerCase() as WorkspaceMember['role'],
          })),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}

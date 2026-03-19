import {
  Component,
  input,
  model,
  signal,
  inject,
  effect,
  Injector,
  OnInit,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';
import {
  WorkspaceService,
  UserWorkspaceMembership,
} from '../../../core/services/workspace.service';

@Component({
  selector: 'app-user-profile-dialog',
  standalone: true,
  imports: [CommonModule, RouterLink, Dialog, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      header="Member Profile"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '480px' }"
      [closable]="true"
    >
      <div class="space-y-6">
        <!-- Profile Header -->
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary overflow-hidden flex-shrink-0"
          >
            @if (userAvatar()) {
              <img
                [src]="userAvatar()"
                [alt]="userName()"
                class="w-full h-full object-cover"
              />
            } @else {
              {{ getInitials(userName()) }}
            }
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-lg font-semibold text-[var(--foreground)] truncate">
              {{ userName() }}
            </h3>
            <p class="text-sm text-[var(--muted-foreground)] truncate">
              {{ userEmail() }}
            </p>
          </div>
        </div>

        <!-- Details -->
        <div class="space-y-3">
          @if (jobTitle()) {
            <div class="flex items-center gap-2">
              <span
                class="text-xs text-[var(--muted-foreground)] w-20 flex-shrink-0"
                >Title</span
              >
              <span class="text-sm text-[var(--foreground)]">{{
                jobTitle()
              }}</span>
            </div>
          }
          @if (department()) {
            <div class="flex items-center gap-2">
              <span
                class="text-xs text-[var(--muted-foreground)] w-20 flex-shrink-0"
                >Dept</span
              >
              <span class="text-sm text-[var(--foreground)]">{{
                department()
              }}</span>
            </div>
          }
          @if (memberSince()) {
            <div class="flex items-center gap-2">
              <span
                class="text-xs text-[var(--muted-foreground)] w-20 flex-shrink-0"
                >Since</span
              >
              <span class="text-sm text-[var(--foreground)]">{{
                formatDate(memberSince()!)
              }}</span>
            </div>
          }
        </div>

        <!-- Workspaces -->
        <div>
          <h4 class="text-sm font-medium text-[var(--foreground)] mb-3">
            Workspaces
          </h4>
          @if (loadingWorkspaces()) {
            <p class="text-xs text-[var(--muted-foreground)] animate-pulse">
              Loading workspaces...
            </p>
          } @else if (workspaces().length === 0) {
            <p class="text-xs text-[var(--muted-foreground)]">No workspaces</p>
          } @else {
            <div class="space-y-2">
              @for (ws of workspaces(); track ws.workspace_id) {
                <a
                  [routerLink]="[
                    '/workspace',
                    ws.workspace_id,
                    'team',
                    'member',
                    userId(),
                  ]"
                  (click)="visible.set(false)"
                  class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--secondary)] transition-colors no-underline"
                >
                  <span class="text-sm text-[var(--foreground)] truncate">{{
                    ws.workspace_name
                  }}</span>
                  <p-tag
                    [value]="ws.role"
                    severity="secondary"
                    class="flex-shrink-0"
                  />
                </a>
              }
            </div>
          }
        </div>
      </div>
    </p-dialog>
  `,
})
export class UserProfileDialogComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private injector = inject(Injector);

  visible = model(false);
  userId = input<string>('');
  userName = input<string>('');
  userEmail = input<string>('');
  userAvatar = input<string | null>(null);
  jobTitle = input<string | null>(null);
  department = input<string | null>(null);
  memberSince = input<string | null>(null);

  workspaces = signal<UserWorkspaceMembership[]>([]);
  loadingWorkspaces = signal(false);

  ngOnInit(): void {
    effect(
      () => {
        const uid = this.userId();
        const isVisible = this.visible();
        untracked(() => {
          if (uid && isVisible) {
            this.loadWorkspaces(uid);
          }
        });
      },
      { injector: this.injector },
    );
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private loadWorkspaces(userId: string): void {
    this.loadingWorkspaces.set(true);
    this.workspaceService.getUserWorkspaces(userId).subscribe({
      next: (wms) => {
        this.workspaces.set(wms);
        this.loadingWorkspaces.set(false);
      },
      error: () => {
        this.workspaces.set([]);
        this.loadingWorkspaces.set(false);
      },
    });
  }
}

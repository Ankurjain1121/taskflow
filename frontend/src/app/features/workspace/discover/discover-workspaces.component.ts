import {
  Component,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  WorkspaceService,
  DiscoverableWorkspace,
} from '../../../core/services/workspace.service';

@Component({
  selector: 'app-discover-workspaces',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--background)]">
      <div class="max-w-5xl mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-[var(--foreground)]">
            Discover Workspaces
          </h1>
          <p class="mt-2 text-[var(--muted-foreground)]">
            Browse and join open workspaces in your organization
          </p>
        </div>

        @if (loading()) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (i of [1, 2, 3]; track i) {
              <div
                class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6"
              >
                <div class="skeleton skeleton-text w-32 mb-3"></div>
                <div
                  class="skeleton skeleton-text w-full mb-2"
                  style="height: 0.625rem"
                ></div>
                <div
                  class="skeleton skeleton-text w-20"
                  style="height: 0.625rem"
                ></div>
              </div>
            }
          </div>
        } @else if (error()) {
          <div
            class="bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 rounded-lg p-4 text-sm text-[var(--destructive)]"
          >
            {{ error() }}
          </div>
        } @else if (workspaces().length === 0) {
          <div class="text-center py-16">
            <svg
              class="mx-auto h-12 w-12 text-[var(--muted-foreground)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z"
              />
            </svg>
            <h3 class="mt-4 text-lg font-medium text-[var(--card-foreground)]">
              No workspaces to discover
            </h3>
            <p class="mt-2 text-sm text-[var(--muted-foreground)]">
              There are no open workspaces available to join right now.
            </p>
          </div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (ws of workspaces(); track ws.id) {
              <div
                class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 hover:shadow-md transition-shadow"
              >
                <div class="flex items-start justify-between mb-3">
                  <div
                    class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary"
                  >
                    {{ ws.name.charAt(0).toUpperCase() }}
                  </div>
                </div>
                <h3 class="text-lg font-semibold text-[var(--foreground)] mb-1">
                  {{ ws.name }}
                </h3>
                @if (ws.description) {
                  <p
                    class="text-sm text-[var(--muted-foreground)] mb-3 line-clamp-2"
                  >
                    {{ ws.description }}
                  </p>
                } @else {
                  <p class="text-sm text-[var(--muted-foreground)] italic mb-3">
                    No description
                  </p>
                }
                <div
                  class="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]"
                >
                  <span class="text-xs text-[var(--muted-foreground)]">
                    {{ ws.member_count }}
                    {{ ws.member_count === 1 ? 'member' : 'members' }}
                  </span>
                  <button
                    (click)="onJoin(ws)"
                    [disabled]="joiningId() === ws.id"
                    class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:brightness-90 disabled:opacity-50 transition-all"
                  >
                    @if (joiningId() === ws.id) {
                      Joining...
                    } @else {
                      Join
                    }
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
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
export class DiscoverWorkspacesComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  workspaces = signal<DiscoverableWorkspace[]>([]);
  joiningId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadWorkspaces();
  }

  loadWorkspaces(): void {
    this.loading.set(true);
    this.error.set(null);

    this.workspaceService.discoverWorkspaces().subscribe({
      next: (workspaces) => {
        this.workspaces.set(workspaces);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load discoverable workspaces.');
        this.loading.set(false);
      },
    });
  }

  onJoin(ws: DiscoverableWorkspace): void {
    this.joiningId.set(ws.id);

    this.workspaceService.joinWorkspace(ws.id).subscribe({
      next: () => {
        this.joiningId.set(null);
        this.router.navigate(['/workspace', ws.id]);
      },
      error: () => {
        this.joiningId.set(null);
      },
    });
  }
}

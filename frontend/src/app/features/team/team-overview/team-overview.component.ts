import {
  Component,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  TeamService,
  MemberWorkload,
} from '../../../core/services/team.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { MemberWorkloadCardComponent } from '../member-workload-card/member-workload-card.component';
import { OverloadBannerComponent } from '../overload-banner/overload-banner.component';

@Component({
  selector: 'app-team-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MemberWorkloadCardComponent,
    OverloadBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900">Team Overview</h1>
          <p class="text-sm text-gray-500 mt-1">
            Monitor your team's workload and task distribution
          </p>
        </div>

        <!-- Overload Banner -->
        <app-overload-banner [workspaceId]="workspaceId"></app-overload-banner>

        <!-- Loading State -->
        @if (loading()) {
          <div class="space-y-4">
            @for (i of [1, 2, 3, 4]; track i) {
              <div
                class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4"
              >
                <div
                  class="skeleton skeleton-circle w-10 h-10 flex-shrink-0"
                ></div>
                <div class="flex-1 space-y-2">
                  <div class="skeleton skeleton-text w-32"></div>
                  <div
                    class="skeleton skeleton-text w-20"
                    style="height: 0.625rem"
                  ></div>
                </div>
                <div class="flex gap-2">
                  <div class="skeleton w-12 h-6 rounded-full"></div>
                  <div class="skeleton w-12 h-6 rounded-full"></div>
                </div>
              </div>
            }
          </div>
        }

        <!-- Error State -->
        @if (error()) {
          <div
            class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3"
          >
            <svg
              class="w-5 h-5 text-red-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <div>
              <p class="text-sm font-medium text-red-800">{{ error() }}</p>
              <button
                (click)="loadTeamWorkload()"
                class="text-sm text-red-600 hover:text-red-800 underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        }

        <!-- Empty State -->
        @if (!loading() && !error() && members().length === 0) {
          <div class="animate-fade-in-up text-center py-16">
            <div
              class="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 dark:from-violet-900/30 dark:via-purple-900/20 dark:to-indigo-900/30 flex items-center justify-center mb-5"
            >
              <svg
                class="w-10 h-10 text-violet-500 dark:text-violet-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
            </div>
            <h3
              class="text-lg font-semibold text-gray-900 dark:text-white mb-2"
            >
              Build your team
            </h3>
            <p
              class="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto"
            >
              Invite collaborators to start working together. Great things
              happen with great teams.
            </p>
          </div>
        }

        <!-- Team Grid -->
        @if (!loading() && !error() && members().length > 0) {
          <div
            class="grid gap-4"
            style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))"
          >
            @for (member of members(); track member.user_id) {
              <app-member-workload-card
                [member]="member"
                [workspaceId]="workspaceId"
              ></app-member-workload-card>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class TeamOverviewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private teamService = inject(TeamService);
  private wsService = inject(WebSocketService);
  private destroy$ = new Subject<void>();

  workspaceId = '';

  loading = signal(true);
  error = signal<string | null>(null);
  members = signal<MemberWorkload[]>([]);

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.workspaceId = params['workspaceId'];
      this.loadTeamWorkload();
      this.setupWebSocket();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Unsubscribe from workspace channel
    this.wsService.send('unsubscribe', {
      channel: `workspace:${this.workspaceId}`,
    });
  }

  loadTeamWorkload(): void {
    this.loading.set(true);
    this.error.set(null);

    this.teamService
      .getTeamWorkload(this.workspaceId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (members) => {
          this.members.set(members);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load team workload:', err);
          this.error.set('Failed to load team workload. Please try again.');
          this.loading.set(false);
        },
      });
  }

  private setupWebSocket(): void {
    this.wsService.connect();

    // Subscribe to workspace channel for real-time updates
    this.wsService.send('subscribe', {
      channel: `workspace:${this.workspaceId}`,
    });

    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        this.handleWebSocketMessage(message);
      });
  }

  private handleWebSocketMessage(message: {
    type: string;
    payload: unknown;
  }): void {
    // Handle workload-related events
    switch (message.type) {
      case 'task:created':
      case 'task:updated':
      case 'task:deleted':
      case 'task:moved':
      case 'task:assigned':
      case 'task:unassigned':
        // Reload workload data when task changes occur
        this.loadTeamWorkload();
        break;
      case 'workload:updated': {
        // Direct workload update from server
        const payload = message.payload as { members?: MemberWorkload[] };
        if (payload.members) {
          this.members.set(payload.members);
        }
        break;
      }
    }
  }
}

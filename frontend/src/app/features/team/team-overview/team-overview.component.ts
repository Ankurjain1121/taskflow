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
import { TeamService, MemberWorkload } from '../../../core/services/team.service';
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
        <app-overload-banner
          [workspaceId]="workspaceId"
        ></app-overload-banner>

        <!-- Loading State -->
        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <svg
              class="animate-spin h-8 w-8 text-indigo-600"
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
          <div class="text-center py-12">
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No team members</h3>
            <p class="mt-1 text-sm text-gray-500">
              Invite team members to start tracking workload.
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
    this.wsService.send('unsubscribe', { channel: `workspace:${this.workspaceId}` });
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
    this.wsService.send('subscribe', { channel: `workspace:${this.workspaceId}` });

    this.wsService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        this.handleWebSocketMessage(message);
      });
  }

  private handleWebSocketMessage(message: { type: string; payload: unknown }): void {
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
      case 'workload:updated':
        // Direct workload update from server
        const payload = message.payload as { members?: MemberWorkload[] };
        if (payload.members) {
          this.members.set(payload.members);
        }
        break;
    }
  }
}

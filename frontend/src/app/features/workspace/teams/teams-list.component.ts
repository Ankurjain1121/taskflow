import {
  Component,
  inject,
  signal,
  input,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import {
  TeamGroupsService,
  TeamGroup,
  TeamGroupDetail,
} from '../../../core/services/team-groups.service';
import { TeamDetailDialogComponent } from './team-detail-dialog.component';

@Component({
  selector: 'app-teams-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule, TeamDetailDialogComponent],
  template: `
    <div class="py-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-lg font-semibold text-[var(--foreground)]">Teams</h2>
          <p class="text-sm text-[var(--muted-foreground)]">
            Organize your workspace members into teams
          </p>
        </div>
        <p-button
          label="Create Team"
          icon="pi pi-plus"
          (onClick)="openCreateDialog()"
        />
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
      } @else if (loadError()) {
        <div
          class="text-center py-12 border border-dashed border-red-200 rounded-xl bg-red-50"
        >
          <svg
            class="w-10 h-10 mx-auto text-red-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p class="text-red-700 font-medium mb-1">Could not load teams</p>
          <p class="text-sm text-red-500 mb-4">
            Something went wrong. Please try again.
          </p>
          <button
            class="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
            (click)="loadTeams()"
          >
            Retry
          </button>
        </div>
      } @else if (teams().length === 0) {
        <div
          class="text-center py-12 border border-dashed border-[var(--border)] rounded-xl"
        >
          <svg
            class="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            ></path>
          </svg>
          <p class="text-[var(--muted-foreground)] mb-1">No teams yet</p>
          <p class="text-sm text-[var(--muted-foreground)]">
            Create your first team to organize workspace members
          </p>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (team of teams(); track team.id) {
            <div
              class="border border-[var(--border)] rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer bg-[var(--card)]"
              (click)="openEditDialog(team)"
            >
              <div class="flex items-start gap-3">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                  [style.background-color]="team.color"
                >
                  {{ team.name?.charAt(0)?.toUpperCase() }}
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-[var(--foreground)] truncate">
                    {{ team.name }}
                  </h3>
                  @if (team.description) {
                    <p
                      class="text-sm text-[var(--muted-foreground)] mt-0.5 line-clamp-2"
                    >
                      {{ team.description }}
                    </p>
                  }
                  <div
                    class="flex items-center gap-1.5 mt-2 text-xs text-[var(--muted-foreground)]"
                  >
                    <svg
                      class="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                      ></path>
                    </svg>
                    {{
                      team.member_count === 1
                        ? '1 member'
                        : team.member_count + ' members'
                    }}
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Create/Edit Dialog -->
      <app-team-detail-dialog
        [(visible)]="dialogVisible"
        [workspaceId]="workspaceId()"
        [editTeam]="editingTeam()"
        (saved)="onTeamSaved($event)"
        (deleted)="onTeamDeleted($event)"
      />
    </div>
  `,
})
export class TeamsListComponent implements OnInit {
  private teamGroupsService = inject(TeamGroupsService);
  private messageService = inject(MessageService);

  workspaceId = input.required<string>();

  teams = signal<TeamGroup[]>([]);
  loading = signal(true);
  loadError = signal(false);
  dialogVisible = signal(false);
  editingTeam = signal<TeamGroupDetail | null>(null);

  ngOnInit(): void {
    this.loadTeams();
  }

  openCreateDialog(): void {
    this.editingTeam.set(null);
    this.dialogVisible.set(true);
  }

  openEditDialog(team: TeamGroup): void {
    this.teamGroupsService.getTeam(team.id).subscribe({
      next: (detail) => {
        this.editingTeam.set(detail);
        this.dialogVisible.set(true);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Could not load team details',
        });
      },
    });
  }

  onTeamSaved(team: TeamGroupDetail): void {
    this.loadTeams();
  }

  onTeamDeleted(teamId: string): void {
    this.teams.update((list) => list.filter((t) => t.id !== teamId));
  }

  loadTeams(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.teamGroupsService.listTeams(this.workspaceId()).subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }
}

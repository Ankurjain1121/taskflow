import {
  Component,
  signal,
  inject,
  input,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  TeamService,
  MemberWorkload,
} from '../../../core/services/team.service';

@Component({
  selector: 'app-team-workload',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card p-5 h-full">
      <h3 class="widget-title mb-4 flex items-center gap-2">
        <i class="pi pi-users text-primary text-sm"></i>
        Team Workload
      </h3>

      @if (!workspaceId()) {
        <div
          class="flex items-center justify-center h-44"
          style="color: var(--muted-foreground)"
        >
          <div class="text-center">
            <i class="pi pi-filter text-xl mb-2"></i>
            <p class="text-sm">Select a workspace to view team workload</p>
          </div>
        </div>
      } @else if (loading()) {
        <div class="space-y-4">
          @for (i of [1, 2, 3]; track i) {
            <div>
              <div class="flex items-center gap-3 mb-2">
                <div class="w-7 h-7 skeleton rounded-full"></div>
                <div class="flex-1 h-3 skeleton rounded"></div>
              </div>
              <div class="h-2 skeleton rounded-full"></div>
            </div>
          }
        </div>
      } @else if (members().length === 0) {
        <div
          class="flex items-center justify-center h-44"
          style="color: var(--muted-foreground)"
        >
          <p class="text-sm">No team members found</p>
        </div>
      } @else {
        <div class="space-y-3.5">
          @for (member of members(); track member.user_id) {
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-2">
                  @if (member.user_avatar) {
                    <img
                      [src]="member.user_avatar"
                      [alt]="member.user_name"
                      class="w-6 h-6 rounded-full object-cover"
                    />
                  } @else {
                    <div
                      class="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                    >
                      <span class="text-[10px] font-medium text-white">
                        {{ member.user_name.charAt(0).toUpperCase() }}
                      </span>
                    </div>
                  }
                  <span
                    class="text-sm font-medium truncate max-w-[120px]"
                    style="color: var(--foreground)"
                  >
                    {{ member.user_name }}
                  </span>
                </div>
                <div
                  class="flex items-center gap-2 text-xs"
                  style="color: var(--muted-foreground)"
                >
                  <span>{{ member.active_tasks }} active</span>
                  @if (member.overdue_tasks > 0) {
                    <span class="text-red-500 font-medium"
                      >{{ member.overdue_tasks }} overdue</span
                    >
                  }
                </div>
              </div>
              <!-- Workload bar -->
              <div
                class="w-full h-2 rounded-full overflow-hidden"
                style="background: var(--muted)"
              >
                <div
                  class="h-full rounded-full transition-all duration-500"
                  [class]="getBarColor(member)"
                  [style.width.%]="getBarWidth(member)"
                ></div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TeamWorkloadComponent {
  private teamService = inject(TeamService);

  workspaceId = input<string | undefined>();

  loading = signal(false);
  members = signal<MemberWorkload[]>([]);

  constructor() {
    effect(() => {
      const wsId = this.workspaceId();
      if (wsId) {
        this.loadWorkload(wsId);
      } else {
        this.members.set([]);
      }
    });
  }

  getBarColor(member: MemberWorkload): string {
    if (member.is_overloaded) return 'bg-red-500';
    if (member.overdue_tasks > 0) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  getBarWidth(member: MemberWorkload): number {
    if (member.total_tasks === 0) return 0;
    const maxTasks = 20;
    return Math.min((member.active_tasks / maxTasks) * 100, 100);
  }

  private loadWorkload(workspaceId: string): void {
    this.loading.set(true);
    this.teamService.getTeamWorkload(workspaceId).subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: () => {
        this.members.set([]);
        this.loading.set(false);
      },
    });
  }
}

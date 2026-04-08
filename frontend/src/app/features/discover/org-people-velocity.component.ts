import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MemberWorkload } from '../../core/services/team.service';
import { VelocityPoint } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-org-people-velocity',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Left: Team Workload -->
      <div class="rounded-xl p-5" style="background: var(--card); border: 1px solid var(--border)">
        <h3 class="text-sm font-semibold mb-3" style="color: var(--foreground)">
          Team Workload
        </h3>
        @if (topMembers().length === 0) {
          <p class="text-xs" style="color: var(--muted-foreground)">No workload data available.</p>
        } @else {
          <div class="space-y-2.5">
            @for (member of topMembers(); track member.user_id) {
              <div class="flex items-center gap-3">
                <!-- Avatar initials -->
                <div class="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                  {{ getInitials(member.user_name) }}
                </div>
                <span class="text-xs truncate w-20 shrink-0" style="color: var(--foreground)">
                  {{ member.user_name }}
                </span>
                <!-- Bar -->
                <div class="flex-1 h-2 rounded-full" style="background: var(--muted)">
                  <div class="h-2 rounded-full transition-all"
                       [style.width.%]="getBarWidth(member.active_tasks)"
                       [style.background]="member.active_tasks >= 10 ? '#B81414' : 'var(--primary)'">
                  </div>
                </div>
                <span class="text-xs font-medium shrink-0"
                      [class.text-[var(--destructive)]]="member.active_tasks >= 10"
                      [style.color]="member.active_tasks < 10 ? 'var(--muted-foreground)' : undefined">
                  {{ member.active_tasks }}
                  @if (member.active_tasks >= 10) { <span class="text-[10px]">!</span> }
                </span>
              </div>
            }
          </div>
          @if (overloadedCount() > 0) {
            <p class="text-[11px] text-[var(--destructive)] mt-3">
              {{ overloadedCount() }} {{ overloadedCount() === 1 ? 'member' : 'members' }} overloaded
            </p>
          }
        }
      </div>

      <!-- Right: Velocity -->
      <div class="rounded-xl p-5" style="background: var(--card); border: 1px solid var(--border)">
        <h3 class="text-sm font-semibold mb-3" style="color: var(--foreground)">
          Org Velocity
        </h3>
        @if (velocity().length === 0) {
          <p class="text-xs" style="color: var(--muted-foreground)">No velocity data yet.</p>
        } @else {
          <!-- ASCII-style sparkline using bars -->
          <div class="flex items-end gap-1 h-16 mb-3">
            @for (point of velocity(); track point.week_start) {
              <div class="flex-1 rounded-t"
                   [style.height.%]="getSparkHeight(point.tasks_completed)"
                   [style.background]="'var(--primary)'"
                   [style.opacity]="0.4 + (getSparkHeight(point.tasks_completed) / 100 * 0.6)"
                   [title]="point.week_start + ': ' + point.tasks_completed + ' tasks'">
              </div>
            }
          </div>
          <div class="flex items-center justify-between">
            <div>
              <span class="text-2xl font-bold" style="color: var(--foreground)">
                {{ latestVelocity() }}
              </span>
              <span class="text-xs ml-1" style="color: var(--muted-foreground)">/week</span>
            </div>
            <div class="text-right">
              <div class="text-xs" style="color: var(--muted-foreground)">
                On-time: {{ onTimePct() }}%
              </div>
              @if (velocityTrend() !== 0) {
                <div class="text-xs" [class.text-[var(--success)]]="velocityTrend() > 0" [class.text-[var(--destructive)]]="velocityTrend() < 0">
                  {{ velocityTrend() > 0 ? '\u2191' : '\u2193' }} {{ Math.abs(velocityTrend()) }}% vs last month
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class OrgPeopleVelocityComponent {
  workloads = input<MemberWorkload[]>([]);
  velocity = input<VelocityPoint[]>([]);
  onTimePct = input<number>(100);

  protected readonly Math = Math;

  topMembers = computed(() => {
    return [...this.workloads()]
      .sort((a, b) => b.active_tasks - a.active_tasks)
      .slice(0, 8);
  });

  overloadedCount = computed(() => this.workloads().filter(m => m.active_tasks >= 10).length);

  latestVelocity = computed(() => {
    const v = this.velocity();
    return v.length > 0 ? v[v.length - 1].tasks_completed : 0;
  });

  velocityTrend = computed(() => {
    const v = this.velocity();
    if (v.length < 5) return 0;
    const recent4 = v.slice(-4).reduce((s, p) => s + p.tasks_completed, 0);
    const prev4 = v.slice(-8, -4).reduce((s, p) => s + p.tasks_completed, 0);
    if (prev4 === 0) return 0;
    return Math.round(((recent4 - prev4) / prev4) * 100);
  });

  maxTasks = computed(() => Math.max(...this.workloads().map(m => m.active_tasks), 1));

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
  }

  getBarWidth(tasks: number): number {
    return Math.min(100, (tasks / this.maxTasks()) * 100);
  }

  getSparkHeight(tasks: number): number {
    const max = Math.max(...this.velocity().map(v => v.tasks_completed), 1);
    return Math.min(100, (tasks / max) * 100);
  }
}

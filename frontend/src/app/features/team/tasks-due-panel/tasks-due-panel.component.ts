import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MemberWorkload } from '../../../core/services/team.service';

interface WorkspaceTeam {
  workspace: { id: string; name: string };
  members: MemberWorkload[];
}

interface TableTotals {
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  active: number;
}

type WorkspaceTableData = WorkspaceTeam & { totals: TableTotals };

@Component({
  selector: 'app-tasks-due-panel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Summary Stat Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <div class="widget-card p-4 text-center">
        <p
          class="text-xs font-medium mb-1"
          style="color: var(--muted-foreground)"
        >
          Total Overdue
        </p>
        <p
          class="text-2xl font-bold"
          [class.text-red-500]="summary().totalOverdue > 0"
          [style.color]="
            summary().totalOverdue === 0 ? 'var(--foreground)' : ''
          "
        >
          {{ summary().totalOverdue }}
        </p>
      </div>
      <div class="widget-card p-4 text-center">
        <p
          class="text-xs font-medium mb-1"
          style="color: var(--muted-foreground)"
        >
          Due Today
        </p>
        <p
          class="text-2xl font-bold"
          [class.text-amber-600]="summary().dueToday > 0"
          [style.color]="summary().dueToday === 0 ? 'var(--foreground)' : ''"
        >
          {{ summary().dueToday }}
        </p>
      </div>
      <div class="widget-card p-4 text-center">
        <p
          class="text-xs font-medium mb-1"
          style="color: var(--muted-foreground)"
        >
          Due This Week
        </p>
        <p class="text-2xl font-bold text-blue-600">
          {{ summary().dueThisWeek }}
        </p>
      </div>
      <div class="widget-card p-4 text-center">
        <p
          class="text-xs font-medium mb-1"
          style="color: var(--muted-foreground)"
        >
          No Due Date
        </p>
        <p class="text-2xl font-bold" style="color: var(--muted-foreground)">
          {{ summary().noDueDate }}
        </p>
      </div>
    </div>

    <!-- Per-Workspace Tables -->
    @for (ws of workspaceTables(); track ws.workspace.id) {
      <div
        class="mb-6 rounded-lg border overflow-hidden"
        style="border-color: var(--border); background: var(--card)"
      >
        <div
          class="px-4 py-3 font-semibold text-sm"
          style="color: var(--foreground); border-bottom: 1px solid var(--border); background: var(--secondary)"
        >
          {{ ws.workspace.name }}
        </div>
        <div class="overflow-x-auto max-h-80 overflow-y-auto">
          <table class="w-full text-sm" style="color: var(--foreground)">
            <thead>
              <tr
                class="sticky top-0 text-xs text-left"
                style="background: var(--secondary); color: var(--muted-foreground)"
              >
                <th class="px-4 py-2.5 font-medium">Employee</th>
                <th class="px-4 py-2.5 font-medium text-right">Overdue</th>
                <th class="px-4 py-2.5 font-medium text-right">Due Today</th>
                <th class="px-4 py-2.5 font-medium text-right">This Week</th>
                <th class="px-4 py-2.5 font-medium text-right">Active</th>
              </tr>
            </thead>
            <tbody>
              @for (member of ws.members; track member.user_id) {
                <tr
                  class="border-t hover:bg-[var(--secondary)] transition-colors"
                  style="border-color: var(--border)"
                >
                  <td class="px-4 py-2.5">
                    <a
                      [routerLink]="[
                        '/workspace',
                        ws.workspace.id,
                        'team',
                        'member',
                        member.user_id,
                      ]"
                      class="flex items-center gap-2 hover:underline"
                      style="color: var(--foreground)"
                    >
                      @if (member.user_avatar) {
                        <img
                          [src]="member.user_avatar"
                          [alt]="member.user_name"
                          class="w-6 h-6 rounded-full object-cover flex-shrink-0"
                        />
                      } @else {
                        <div
                          class="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
                        >
                          <span class="text-[10px] font-medium text-white">
                            {{ member.user_name.charAt(0).toUpperCase() }}
                          </span>
                        </div>
                      }
                      <span class="truncate max-w-[180px]">{{
                        member.user_name
                      }}</span>
                    </a>
                  </td>
                  <td
                    class="px-4 py-2.5 text-right font-medium"
                    [class.text-red-500]="member.overdue_tasks > 0"
                  >
                    {{ member.overdue_tasks }}
                  </td>
                  <td
                    class="px-4 py-2.5 text-right font-medium"
                    [class.text-amber-600]="member.due_today > 0"
                  >
                    {{ member.due_today }}
                  </td>
                  <td
                    class="px-4 py-2.5 text-right font-medium"
                    [class.text-blue-600]="member.due_this_week > 0"
                  >
                    {{ member.due_this_week }}
                  </td>
                  <td
                    class="px-4 py-2.5 text-right"
                    style="color: var(--muted-foreground)"
                  >
                    {{ member.active_tasks }}
                  </td>
                </tr>
              }
              <!-- Totals Row -->
              <tr
                class="border-t font-semibold text-xs"
                style="border-color: var(--border); background: var(--secondary); color: var(--muted-foreground)"
              >
                <td class="px-4 py-2.5">Total ({{ ws.members.length }})</td>
                <td
                  class="px-4 py-2.5 text-right"
                  [class.text-red-500]="ws.totals.overdue > 0"
                >
                  {{ ws.totals.overdue }}
                </td>
                <td
                  class="px-4 py-2.5 text-right"
                  [class.text-amber-600]="ws.totals.dueToday > 0"
                >
                  {{ ws.totals.dueToday }}
                </td>
                <td class="px-4 py-2.5 text-right text-blue-600">
                  {{ ws.totals.dueThisWeek }}
                </td>
                <td class="px-4 py-2.5 text-right">
                  {{ ws.totals.active }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (workspaceTables().length === 0) {
      <div class="text-center py-8" style="color: var(--muted-foreground)">
        <p class="text-sm">No workspace data available.</p>
      </div>
    }
  `,
})
export class TasksDuePanelComponent {
  workspaceTeams = input.required<WorkspaceTeam[]>();

  summary = computed(() => {
    const teams = this.workspaceTeams();
    let totalOverdue = 0;
    let dueToday = 0;
    let dueThisWeek = 0;
    let noDueDate = 0;

    for (const team of teams) {
      for (const m of team.members) {
        totalOverdue += m.overdue_tasks;
        dueToday += m.due_today;
        dueThisWeek += m.due_this_week;
        noDueDate += Math.max(
          0,
          m.active_tasks - m.overdue_tasks - m.due_today - m.due_this_week,
        );
      }
    }
    return { totalOverdue, dueToday, dueThisWeek, noDueDate };
  });

  workspaceTables = computed<WorkspaceTableData[]>(() => {
    return this.workspaceTeams().map((team) => {
      const sorted = [...team.members].sort((a, b) => {
        const overdueDiff = b.overdue_tasks - a.overdue_tasks;
        if (overdueDiff !== 0) return overdueDiff;
        return b.due_today - a.due_today;
      });

      const totals = sorted.reduce(
        (acc, m) => ({
          overdue: acc.overdue + m.overdue_tasks,
          dueToday: acc.dueToday + m.due_today,
          dueThisWeek: acc.dueThisWeek + m.due_this_week,
          active: acc.active + m.active_tasks,
        }),
        { overdue: 0, dueToday: 0, dueThisWeek: 0, active: 0 },
      );

      return {
        workspace: team.workspace,
        members: sorted,
        totals,
      };
    });
  });
}

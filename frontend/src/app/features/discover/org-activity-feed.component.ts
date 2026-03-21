import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DashboardActivityEntry } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-org-activity-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl p-5" style="background: var(--card); border: 1px solid var(--border)">
      <h3 class="text-sm font-semibold mb-3" style="color: var(--foreground)">
        Recent Activity
      </h3>

      @if (activities().length === 0) {
        <p class="text-xs text-center py-4" style="color: var(--muted-foreground)">
          No recent activity across your organization.
        </p>
      } @else {
        <div class="space-y-3">
          @for (entry of activities(); track entry.id) {
            <div class="flex items-start gap-3">
              <!-- Avatar -->
              <div
                class="w-7 h-7 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5"
              >
                {{ getInitials(entry.actor_name) }}
              </div>
              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="text-sm" style="color: var(--foreground)">
                  <span class="font-medium">{{ entry.actor_name }}</span>
                  <span style="color: var(--muted-foreground)">
                    {{ formatAction(entry) }}
                  </span>
                </div>
                <div class="text-[11px] mt-0.5" style="color: var(--muted-foreground)">
                  {{ formatTimeAgo(entry.created_at) }}
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class OrgActivityFeedComponent {
  readonly activities = input<DashboardActivityEntry[]>([]);

  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatAction(entry: DashboardActivityEntry): string {
    const entityName =
      (entry.metadata?.['title'] as string) ||
      (entry.metadata?.['name'] as string) ||
      entry.entity_type;
    const projectName = (entry.metadata?.['project_name'] as string) || '';

    const action = entry.action.replace(/_/g, ' ');

    let result = `${action} "${entityName}"`;
    if (projectName) {
      result += ` in ${projectName}`;
    }
    return result;
  }

  formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
}

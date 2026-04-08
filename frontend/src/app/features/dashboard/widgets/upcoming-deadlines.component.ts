import {
  Component,
  signal,
  inject,
  Injector,
  input,
  effect,
  untracked,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TimelineModule } from 'primeng/timeline';
import {
  DashboardService,
  UpcomingDeadline,
} from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-upcoming-deadlines',
  standalone: true,
  imports: [CommonModule, TimelineModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-card h-full flex flex-col overflow-hidden">
      <div class="px-5 py-3.5" style="border-bottom: 1px solid var(--border)">
        <h3 class="widget-title">Upcoming Deadlines</h3>
        <p class="text-xs mt-0.5" style="color: var(--muted-foreground)">
          Next 14 days
        </p>
      </div>

      @if (loading()) {
        <div class="flex-1 p-5 space-y-3">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="skeleton skeleton-row"></div>
          }
        </div>
      } @else if (deadlines().length > 0) {
        <div class="overflow-auto flex-1 p-5">
          <p-timeline [value]="deadlines()" align="left">
            <ng-template pTemplate="marker" let-item>
              <div
                class="w-2.5 h-2.5 rounded-full"
                style="box-shadow: 0 0 0 3px var(--card)"
                [class]="getUrgencyColor(item.days_until_due)"
              ></div>
            </ng-template>
            <ng-template pTemplate="content" let-item>
              <div
                class="flex flex-col gap-0.5 pb-4 cursor-pointer hover:opacity-80 transition-opacity"
                (click)="navigateToTask(item)"
              >
                <div class="flex items-start justify-between gap-2">
                  <span
                    class="font-medium text-sm"
                    style="color: var(--foreground)"
                    >{{ item.title }}</span
                  >
                  <span
                    class="px-2 py-0.5 text-[11px] font-medium rounded-md flex-shrink-0"
                    [class]="getPriorityClass(item.priority)"
                  >
                    {{ item.priority }}
                  </span>
                </div>
                <span class="text-xs" style="color: var(--muted-foreground)">{{
                  item.board_name
                }}</span>
                <span
                  class="text-xs font-medium"
                  [class]="getUrgencyTextColor(item.days_until_due)"
                >
                  {{ getRelativeTime(item.days_until_due) }}
                </span>
              </div>
            </ng-template>
          </p-timeline>
        </div>
      } @else {
        <div
          class="flex-1 flex items-center justify-center"
          style="color: var(--muted-foreground)"
        >
          <div class="text-center">
            <i
              class="pi pi-calendar text-3xl mb-2"
              style="color: var(--border)"
            ></i>
            <p class="text-sm">No upcoming deadlines</p>
          </div>
        </div>
      }
    </div>
  `,
})
export class UpcomingDeadlinesComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private router = inject(Router);
  private injector = inject(Injector);

  workspaceId = input<string | undefined>();

  loading = signal(true);
  deadlines = signal<UpcomingDeadline[]>([]);

  ngOnInit(): void {
    effect(
      () => {
        this.workspaceId();
        untracked(() => this.loadData());
      },
      { injector: this.injector },
    );
  }

  async loadData() {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.dashboardService.getUpcomingDeadlines(14, this.workspaceId()),
      );
      this.deadlines.set(data || []);
    } catch {
      // Timeline will show empty state
    } finally {
      this.loading.set(false);
    }
  }

  navigateToTask(deadline: UpcomingDeadline): void {
    this.router.navigate(['/task', deadline.id]);
  }

  getRelativeTime(days: number): string {
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days < 7) return `Due in ${days} days`;
    const weeks = Math.floor(days / 7);
    return `Due in ${weeks} week${weeks > 1 ? 's' : ''}`;
  }

  getUrgencyColor(days: number): string {
    if (days === 0) return 'bg-[var(--destructive)]';
    if (days <= 2) return 'bg-[var(--accent-warm)]';
    if (days <= 7) return 'bg-amber-500';
    return 'bg-[var(--primary)]';
  }

  getUrgencyTextColor(days: number): string {
    if (days === 0) return 'text-[var(--destructive)]';
    if (days <= 2) return 'text-[var(--accent-warm)]';
    if (days <= 7) return 'text-amber-600';
    return 'text-[var(--primary)]';
  }

  getPriorityClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-[var(--destructive)]/10 text-[var(--destructive)]';
      case 'high':
        return 'bg-[var(--accent-warm)]/10 text-[var(--accent-warm)]';
      case 'medium':
        return 'bg-[var(--primary)]/10 text-[var(--primary)]';
      case 'low':
        return 'bg-[var(--muted)] text-[var(--foreground)]';
      default:
        return 'bg-[var(--muted)] text-[var(--muted-foreground)]';
    }
  }
}

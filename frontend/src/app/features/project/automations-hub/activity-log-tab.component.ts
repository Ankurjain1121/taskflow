import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import {
  AutomationService,
  AutomationActivityEntry,
} from '../../../core/services/automation.service';

@Component({
  selector: 'app-activity-log-tab',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Filter bar -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-medium text-[var(--foreground)]">
        Automation Activity
      </h3>
    </div>

    <!-- Loading -->
    @if (loading()) {
      <div class="flex items-center justify-center py-16">
        <i class="pi pi-spin pi-spinner text-2xl text-[var(--muted-foreground)]"></i>
      </div>
    } @else if (entries().length === 0) {
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <i
          class="pi pi-history text-4xl text-[var(--muted-foreground)] opacity-40 mb-4"
        ></i>
        <h3 class="text-lg font-medium text-[var(--foreground)] mb-2">
          No activity yet
        </h3>
        <p class="text-sm text-[var(--muted-foreground)]">
          Activity will appear here when automation rules fire.
        </p>
      </div>
    } @else {
      <!-- Activity feed -->
      <div class="space-y-2">
        @for (entry of entries(); track entry.id) {
          <div
            class="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]"
          >
            <!-- Type icon -->
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--primary)]/10"
            >
              <i class="pi pi-bolt text-[var(--primary)] text-sm"></i>
            </div>
            <!-- Content -->
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-medium text-[var(--foreground)] truncate"
              >
                {{ entry.name }}
              </p>
              <p class="text-xs text-[var(--muted-foreground)]">
                {{ getRelativeTime(entry.triggered_at) }}
              </p>
            </div>
            <!-- Status -->
            <span
              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              [class]="getStatusClass(entry.status)"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                [class]="getStatusDotClass(entry.status)"
              ></span>
              {{ entry.status }}
            </span>
          </div>
        }
      </div>

      <!-- Load more button -->
      @if (hasMore() && !loading()) {
        <div class="flex justify-center mt-4">
          <button
            pButton
            label="Load more"
            [text]="true"
            severity="secondary"
            (click)="loadMore()"
          ></button>
        </div>
      }
    }
  `,
})
export class ActivityLogTabComponent implements OnInit {
  private readonly automationService = inject(AutomationService);

  projectId = input.required<string>();

  entries = signal<AutomationActivityEntry[]>([]);
  loading = signal(true);
  hasMore = signal(true);
  offset = signal(0);

  private readonly PAGE_SIZE = 50;

  ngOnInit(): void {
    this.loadEntries();
  }

  getRelativeTime(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  getStatusClass(status: string): string {
    if (status === 'success') return 'bg-emerald-500/10 text-emerald-600';
    if (status === 'error') return 'bg-red-500/10 text-red-600';
    return 'bg-amber-500/10 text-amber-600';
  }

  getStatusDotClass(status: string): string {
    if (status === 'success') return 'bg-emerald-500';
    if (status === 'error') return 'bg-red-500';
    return 'bg-amber-500';
  }

  loadMore(): void {
    const newOffset = this.offset() + this.PAGE_SIZE;
    this.offset.set(newOffset);
    this.automationService
      .getProjectActivity(this.projectId(), this.PAGE_SIZE, newOffset)
      .subscribe({
        next: (newEntries) => {
          this.entries.update((existing) => [...existing, ...newEntries]);
          this.hasMore.set(newEntries.length === this.PAGE_SIZE);
        },
      });
  }

  private loadEntries(): void {
    this.loading.set(true);
    this.automationService
      .getProjectActivity(this.projectId(), this.PAGE_SIZE, 0)
      .subscribe({
        next: (data) => {
          this.entries.set(data);
          this.hasMore.set(data.length === this.PAGE_SIZE);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }
}

import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MyTasksService, MyTasksSummary } from '../../core/services/my-tasks.service';
import { MyWorkTimelineComponent } from './my-work-timeline.component';
import { MyWorkMatrixComponent } from './my-work-matrix.component';
import { MyWorkBoardComponent } from './my-work-board.component';

type MyWorkTab = 'timeline' | 'matrix' | 'board';

const TAB_STORAGE_KEY = 'taskbolt_mywork_tab';

@Component({
  selector: 'app-my-work-shell',
  standalone: true,
  imports: [MyWorkTimelineComponent, MyWorkMatrixComponent, MyWorkBoardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <!-- Summary bar -->
        @if (summary()) {
          <div
            class="flex items-center gap-6 mb-5 px-4 py-3 rounded-lg"
            style="background: var(--card); border: 1px solid var(--border)"
          >
            <h1 class="text-xl font-bold font-display" style="color: var(--foreground)">My Work</h1>
            <div class="flex items-center gap-4 ml-auto text-sm">
              <span style="color: var(--muted-foreground)">
                <span class="font-semibold" style="color: var(--foreground)">{{ summary()!.total_assigned }}</span> tasks
              </span>
              @if (summary()!.overdue > 0) {
                <span style="color: var(--destructive)">
                  <span class="font-semibold">{{ summary()!.overdue }}</span> overdue
                </span>
              }
              <span style="color: var(--muted-foreground)">
                <span class="font-semibold" style="color: var(--foreground)">{{ summary()!.due_soon }}</span> due soon
              </span>
              <span style="color: var(--success)">
                <span class="font-semibold">{{ summary()!.completed_this_week }}</span> done this week
              </span>
            </div>
          </div>
        }

        <!-- Tab bar (desktop) -->
        <div class="hidden md:flex items-center gap-1 mb-6 border-b" style="border-color: var(--border)">
          @for (tab of tabs; track tab.key) {
            <button
              (click)="activeTab.set(tab.key)"
              class="px-4 py-2.5 text-sm font-medium transition-colors relative"
              [style.color]="activeTab() === tab.key ? 'var(--foreground)' : 'var(--muted-foreground)'"
              [style.font-weight]="activeTab() === tab.key ? '600' : '400'"
            >
              {{ tab.label }}
              @if (activeTab() === tab.key) {
                <span
                  class="absolute bottom-0 left-0 right-0 h-[3px] rounded-t"
                  style="background: var(--primary)"
                ></span>
              }
            </button>
          }
        </div>

        <!-- Tab selector (mobile) -->
        <div class="md:hidden mb-4">
          <select
            [value]="activeTab()"
            (change)="onMobileTabChange($event)"
            aria-label="Select view"
            class="w-full px-3 py-2 rounded-lg text-sm font-medium"
            style="background: var(--card); border: 1px solid var(--border); color: var(--foreground)"
          >
            @for (tab of tabs; track tab.key) {
              <option [value]="tab.key">{{ tab.label }}</option>
            }
          </select>
        </div>

        <!-- Tab content -->
        @switch (activeTab()) {
          @case ('timeline') { <app-my-work-timeline /> }
          @case ('matrix') { <app-my-work-matrix /> }
          @case ('board') { <app-my-work-board /> }
        }
      </div>
    </div>
  `,
})
export class MyWorkShellComponent implements OnInit {
  private myTasksService = inject(MyTasksService);
  private route = inject(ActivatedRoute);

  readonly tabs: { key: MyWorkTab; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'matrix', label: 'Matrix' },
    { key: 'board', label: 'Board' },
  ];

  readonly activeTab = signal<MyWorkTab>(this.loadSavedTab());
  readonly summary = signal<MyTasksSummary | null>(null);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(TAB_STORAGE_KEY, this.activeTab());
      } catch {
        // localStorage unavailable
      }
    });
  }

  ngOnInit() {
    this.loadSummary();
  }

  onMobileTabChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as MyWorkTab;
    this.activeTab.set(value);
  }

  private async loadSummary() {
    try {
      const summary = await firstValueFrom(this.myTasksService.getMyTasksSummary());
      this.summary.set(summary || null);
    } catch {
      // Summary unavailable
    }
  }

  private loadSavedTab(): MyWorkTab {
    // Check route data for default tab (e.g. from /eisenhower redirect)
    const routeData = this.route?.snapshot?.data;
    if (routeData?.['defaultTab']) {
      const tab = routeData['defaultTab'];
      if (tab === 'timeline' || tab === 'matrix' || tab === 'board') {
        return tab;
      }
    }
    try {
      const saved = localStorage.getItem(TAB_STORAGE_KEY);
      if (saved === 'timeline' || saved === 'matrix' || saved === 'board') {
        return saved;
      }
    } catch {
      // localStorage unavailable
    }
    return 'timeline';
  }
}

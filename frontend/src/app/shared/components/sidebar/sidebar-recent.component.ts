import {
  Component,
  inject,
  signal,
  input,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';

export interface RecentBoardEntry {
  id: string;
  name: string;
  workspaceId: string;
  visitedAt: number;
}

const STORAGE_KEY = 'taskflow_recent_boards';
const MAX_ITEMS = 5;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Component({
  selector: 'app-sidebar-recent',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!collapsed()) {
      <div class="mb-1">
        <div class="sidebar-section-label">
          <i class="pi pi-clock text-xs"></i>
          <span>Recent</span>
        </div>

        @if (recentItems().length === 0) {
          <p class="px-3 py-2 text-xs italic" style="color: var(--sidebar-text-muted)">
            No recent boards
          </p>
        } @else {
          <div class="space-y-0.5">
            @for (item of recentItems(); track item.id) {
              <a
                [routerLink]="['/workspace', item.workspaceId, 'board', item.id]"
                routerLinkActive="active"
                class="nav-item flex items-center gap-2 px-3 py-1.5 rounded-md text-sm"
              >
                <i class="pi pi-table text-xs" style="color: var(--sidebar-text-muted)"></i>
                <span class="truncate">{{ item.name }}</span>
              </a>
            }
          </div>
        }
      </div>
    } @else {
      <div class="flex justify-center py-2" title="Recent">
        <i class="pi pi-clock text-xs" style="color: var(--sidebar-text-muted)"></i>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .nav-item {
      transition: background var(--duration-fast) var(--ease-standard),
                  color var(--duration-fast) var(--ease-standard);
      color: var(--sidebar-text-secondary);
    }
    .nav-item:hover {
      background: var(--sidebar-surface-hover);
    }
    .nav-item.active {
      background: var(--sidebar-surface-active);
      color: var(--sidebar-text-primary);
    }
  `],
})
export class SidebarRecentComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private routerSub: Subscription | null = null;

  collapsed = input(false);
  recentItems = signal<RecentBoardEntry[]>([]);

  ngOnInit(): void {
    this.loadFromStorage();
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event) => this.onNavigationEnd(event));
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private onNavigationEnd(event: NavigationEnd): void {
    const match = event.urlAfterRedirects.match(
      /\/workspace\/([^/]+)\/board\/([^/?]+)/
    );
    if (!match) return;

    const workspaceId = match[1];
    const boardId = match[2];

    this.addRecentEntry({
      id: boardId,
      name: boardId.substring(0, 8) + '...',
      workspaceId,
      visitedAt: Date.now(),
    });
  }

  addRecentEntry(entry: RecentBoardEntry): void {
    const items = this.recentItems().filter((i) => i.id !== entry.id);
    const updated = [entry, ...items].slice(0, MAX_ITEMS);
    this.recentItems.set(updated);
    this.saveToStorage(updated);
  }

  updateEntryName(boardId: string, name: string): void {
    const items = this.recentItems().map((i) =>
      i.id === boardId ? { ...i, name } : i
    );
    this.recentItems.set(items);
    this.saveToStorage(items);
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const items: RecentBoardEntry[] = JSON.parse(raw);
      const now = Date.now();
      const valid = items.filter((i) => now - i.visitedAt < TTL_MS);
      this.recentItems.set(valid.slice(0, MAX_ITEMS));
    } catch {
      // Corrupted localStorage data
    }
  }

  private saveToStorage(items: RecentBoardEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage full or unavailable
    }
  }
}

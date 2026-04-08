import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { WorkspaceContextService } from '../../../../core/services/workspace-context.service';

@Component({
  selector: 'app-help-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)]">
      <header class="bg-[var(--card)] shadow-sm border-b border-[var(--border)]">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold font-display text-[var(--card-foreground)]">Help Center</h1>
              <p class="text-[var(--muted-foreground)] mt-1 text-sm">Learn how to use TaskBolt effectively</p>
            </div>
          </div>
          <div class="mt-4 relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-sm"></i>
            <input
              type="text"
              placeholder="Search help articles..."
              class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow"
              [value]="searchQuery()"
              (input)="searchQuery.set($any($event.target).value)"
              (keydown.enter)="onSearch()"
            />
          </div>
        </div>
      </header>
      <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <router-outlet />
      </main>
    </div>
  `,
})
export class HelpLayoutComponent {
  private readonly router = inject(Router);
  private readonly wsContext = inject(WorkspaceContextService);
  readonly searchQuery = signal('');

  onSearch(): void {
    const q = this.searchQuery().trim();
    if (!q) return;
    const wsId = this.wsContext.activeWorkspaceId();
    const base = wsId ? `/workspace/${wsId}/help` : '/help';
    this.router.navigate([base, 'search'], { queryParams: { q } });
  }
}

import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import {
  SavedViewService,
  SavedView,
} from '../../../core/services/saved-view.service';

export interface ViewOption {
  id: string;
  label: string;
  icon: string;
  section: 'recent' | 'project' | 'saved' | 'workspace';
}

const PROJECT_VIEWS: ViewOption[] = [
  { id: 'kanban', label: 'Kanban Board', icon: 'pi-th-large', section: 'project' },
  { id: 'list', label: 'List View', icon: 'pi-list', section: 'project' },
  { id: 'table', label: 'Table View', icon: 'pi-table', section: 'project' },
  { id: 'calendar', label: 'Calendar', icon: 'pi-calendar', section: 'project' },
  { id: 'gantt', label: 'Gantt Chart', icon: 'pi-chart-bar', section: 'project' },
];

const WORKSPACE_VIEWS: ViewOption[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'pi-home', section: 'workspace' },
  { id: 'my-work', label: 'My Work', icon: 'pi-check-square', section: 'workspace' },
  { id: 'all-tasks', label: 'All Tasks', icon: 'pi-inbox', section: 'workspace' },
  { id: 'eisenhower', label: 'Eisenhower Matrix', icon: 'pi-th-large', section: 'workspace' },
];

const SELECTED_BG = 'rgba(99,102,241,0.1)';

@Component({
  selector: 'app-view-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-[18vh]"
        (click)="close()"
        (keydown)="onKeydown($event)"
      >
        <div
          class="w-full max-w-md rounded-lg shadow-2xl border overflow-hidden"
          style="background: var(--card); border-color: var(--border)"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-label="View Switcher"
        >
          <!-- Search -->
          <div class="flex items-center gap-2 px-3 py-2.5 border-b" style="border-color: var(--border)">
            <i class="pi pi-search text-sm" style="color: var(--muted-foreground)"></i>
            <input
              #searchInput
              type="text"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
              placeholder="Switch view..."
              class="flex-1 bg-transparent border-none outline-none text-sm"
              style="color: var(--card-foreground)"
              autocomplete="off"
              (keydown)="onInputKeydown($event)"
            />
            <kbd class="hidden sm:inline px-1.5 py-0.5 text-[10px] rounded"
              style="background: var(--secondary); color: var(--muted-foreground)">ESC</kbd>
          </div>

          <!-- Results -->
          <div class="max-h-[50vh] overflow-y-auto py-1" #resultsList>
            @for (section of sections(); track section.label) {
              @if (section.items.length > 0) {
                <div class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                  style="color: var(--muted-foreground)">
                  {{ section.label }}
                </div>
                @for (item of section.items; track item.id; let idx = $index) {
                  @let flatIdx = getFlatIndex(section.label, idx);
                  <button
                    [attr.data-idx]="flatIdx"
                    class="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-sm rounded transition-colors"
                    [style.background]="selectedIndex() === flatIdx ? selectedBg : ''"
                    (click)="selectView(item)"
                    (mouseenter)="selectedIndex.set(flatIdx)"
                  >
                    <i [class]="'pi ' + item.icon + ' text-xs'" style="color: var(--muted-foreground)"></i>
                    <span style="color: var(--card-foreground)">{{ item.label }}</span>
                  </button>
                }
              }
            }
            @if (flatItems().length === 0) {
              <div class="py-6 text-center text-sm" style="color: var(--muted-foreground)">
                No matching views
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="flex items-center gap-3 px-3 py-1.5 border-t text-[10px]"
            style="border-color: var(--border); color: var(--muted-foreground)">
            <span><kbd class="px-1 py-0.5 rounded" style="background: var(--secondary)">&#8593;&#8595;</kbd> navigate</span>
            <span><kbd class="px-1 py-0.5 rounded" style="background: var(--secondary)">&#9166;</kbd> select</span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @media (prefers-reduced-motion: reduce) {
      .backdrop-blur-sm { backdrop-filter: none !important; }
    }
  `],
})
export class ViewSwitcherComponent implements OnInit, OnDestroy {
  readonly isOpen = input(false);
  readonly closed = output<void>();
  readonly viewSelected = output<ViewOption>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('resultsList') resultsList!: ElementRef<HTMLDivElement>;

  private readonly shortcuts = inject(KeyboardShortcutsService);
  private readonly savedViewService = inject(SavedViewService);

  readonly selectedBg = SELECTED_BG;
  readonly query = signal('');
  readonly selectedIndex = signal(0);

  private readonly savedViewOptions = computed<ViewOption[]>(() =>
    this.savedViewService.savedViews().map((sv) => ({
      id: `saved:${sv.id}`,
      label: sv.name,
      icon: 'pi-bookmark',
      section: 'saved' as const,
    })),
  );

  private readonly allItems = computed<ViewOption[]>(() => [
    ...PROJECT_VIEWS,
    ...this.savedViewOptions(),
    ...WORKSPACE_VIEWS,
  ]);

  readonly filteredItems = computed<ViewOption[]>(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.allItems();
    return this.allItems().filter((item) =>
      item.label.toLowerCase().includes(q),
    );
  });

  readonly sections = computed(() => {
    const items = this.filteredItems();
    const groups: { label: string; items: ViewOption[] }[] = [
      { label: 'Project Views', items: items.filter((i) => i.section === 'project') },
      { label: 'Saved Views', items: items.filter((i) => i.section === 'saved') },
      { label: 'Workspace', items: items.filter((i) => i.section === 'workspace') },
    ];
    return groups.filter((g) => g.items.length > 0);
  });

  readonly flatItems = computed<ViewOption[]>(() =>
    this.sections().flatMap((s) => s.items),
  );

  getFlatIndex(sectionLabel: string, localIdx: number): number {
    const sects = this.sections();
    let offset = 0;
    for (const s of sects) {
      if (s.label === sectionLabel) return offset + localIdx;
      offset += s.items.length;
    }
    return offset + localIdx;
  }

  ngOnInit(): void {
    setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
  }

  ngOnDestroy(): void {
    /* no-op */
  }

  onInputKeydown(event: KeyboardEvent): void {
    const total = this.flatItems().length;
    if (total === 0) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.update((i) => (i + 1) % total);
        this.scrollIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.update((i) => (i - 1 + total) % total);
        this.scrollIntoView();
        break;
      case 'Enter':
        event.preventDefault();
        this.selectByIndex();
        break;
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
  }

  selectView(view: ViewOption): void {
    this.viewSelected.emit(view);
    this.close();
  }

  close(): void {
    this.query.set('');
    this.selectedIndex.set(0);
    this.closed.emit(undefined);
  }

  private selectByIndex(): void {
    const items = this.flatItems();
    const idx = this.selectedIndex();
    if (idx >= 0 && idx < items.length) {
      this.selectView(items[idx]);
    }
  }

  private scrollIntoView(): void {
    requestAnimationFrame(() => {
      const container = this.resultsList?.nativeElement;
      if (!container) return;
      const el = container.querySelector(
        `[data-idx="${this.selectedIndex()}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest' });
    });
  }
}

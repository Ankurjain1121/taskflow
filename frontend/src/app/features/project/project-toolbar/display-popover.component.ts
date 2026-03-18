import {
  Component,
  input,
  output,
  computed,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Popover } from 'primeng/popover';
import { Tooltip } from 'primeng/tooltip';
import { CardFieldsPopoverComponent, CARD_FIELD_OPTIONS } from './card-fields-popover.component';
import { ViewMode } from './project-toolbar.component';
import { GroupByMode } from '../project-view/swimlane.types';
import { CardFields } from '../project-view/project-state.service';

interface ViewOption {
  value: ViewMode;
  icon: string;
  label: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  { value: 'kanban', icon: 'pi pi-objects-column', label: 'Kanban' },
  { value: 'list', icon: 'pi pi-list', label: 'List' },
  { value: 'calendar', icon: 'pi pi-calendar', label: 'Calendar' },
  { value: 'gantt', icon: 'pi pi-align-left', label: 'Gantt' },
  { value: 'reports', icon: 'pi pi-chart-bar', label: 'Reports' },
  { value: 'time-report', icon: 'pi pi-clock', label: 'Time' },
  { value: 'activity', icon: 'pi pi-history', label: 'Activity' },
];

const GROUP_BY_OPTIONS: { value: GroupByMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'priority', label: 'Priority' },
  { value: 'label', label: 'Label' },
];

const DENSITY_OPTIONS: { value: 'compact' | 'normal' | 'expanded'; label: string; icon: string }[] = [
  { value: 'compact', label: 'Compact', icon: 'pi pi-minus' },
  { value: 'normal', label: 'Normal', icon: 'pi pi-bars' },
  { value: 'expanded', label: 'Expanded', icon: 'pi pi-th-large' },
];

@Component({
  selector: 'app-display-popover',
  standalone: true,
  imports: [CommonModule, FormsModule, Popover, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Display button -->
    <button
      (click)="displayPopover.toggle($event)"
      class="display-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors relative"
      pTooltip="Display settings"
      tooltipPosition="bottom"
    >
      <i [class]="currentViewIcon()" class="text-xs"></i>
      <span class="hidden sm:inline">{{ currentViewLabel() }}</span>
      <i class="pi pi-chevron-down text-[9px] opacity-60"></i>
      @if (hasNonDefaultSettings()) {
        <span
          class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--primary)]"
        ></span>
      }
    </button>

    <p-popover #displayPopover [style]="{ width: '320px' }">
      <div class="p-3 space-y-3">
        <!-- VIEW section -->
        <div>
          <div class="section-label">View</div>
          <div class="grid grid-cols-4 gap-1.5">
            @for (view of viewOptions; track view.value) {
              <button
                (click)="onViewSelect(view.value)"
                [class]="
                  viewMode() === view.value
                    ? 'view-tile view-tile--active'
                    : 'view-tile'
                "
              >
                <i [class]="view.icon" class="text-base mb-1"></i>
                <span class="text-[10px] font-medium leading-tight">{{ view.label }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Kanban-only sections -->
        @if (viewMode() === 'kanban') {
          <!-- DENSITY section -->
          <div class="border-t border-[var(--border)] pt-3">
            <div class="section-label">Layout Density</div>
            <div class="flex gap-1.5">
              @for (d of densityOptions; track d.value) {
                <button
                  (click)="densityChanged.emit(d.value)"
                  [class]="
                    density() === d.value
                      ? 'density-pill density-pill--active'
                      : 'density-pill'
                  "
                >
                  <i [class]="d.icon" class="text-xs"></i>
                  {{ d.label }}
                </button>
              }
            </div>
          </div>

          <!-- CARD FIELDS section -->
          <div class="border-t border-[var(--border)] pt-3">
            <div class="flex items-center justify-between mb-2">
              <div class="section-label mb-0">Card Fields</div>
              <button
                (click)="cardFieldsReset.emit()"
                class="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
              >
                Reset
              </button>
            </div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1">
              @for (field of cardFieldOptions; track field.key) {
                <label
                  class="flex items-center gap-2 py-1 cursor-pointer hover:bg-[var(--secondary)] rounded px-1 text-sm"
                >
                  <input
                    type="checkbox"
                    [checked]="cardFields()[field.key]"
                    (change)="onCardFieldToggle(field.key, $any($event.target).checked)"
                    class="w-3.5 h-3.5 rounded border-[var(--border)] accent-[var(--primary)]"
                  />
                  <span class="text-xs text-[var(--foreground)]">{{ field.label }}</span>
                </label>
              }
            </div>
          </div>

          <!-- GROUP BY section -->
          <div class="border-t border-[var(--border)] pt-3">
            <div class="section-label">Group By</div>
            <div class="flex flex-wrap gap-1.5">
              @for (g of groupByOptions; track g.value) {
                <button
                  (click)="groupByChanged.emit(g.value)"
                  [class]="
                    groupBy() === g.value
                      ? 'density-pill density-pill--active'
                      : 'density-pill'
                  "
                >
                  {{ g.label }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    </p-popover>
  `,
  styles: [
    `
      .section-label {
        font-size: 0.65rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted-foreground);
        margin-bottom: 0.5rem;
      }

      .view-tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 8px 4px;
        border-radius: 8px;
        border: 1px solid var(--border);
        color: var(--muted-foreground);
        transition: all 150ms;
        cursor: pointer;
        background: transparent;
      }
      .view-tile:hover {
        background: var(--secondary);
        color: var(--foreground);
      }
      .view-tile--active {
        background: color-mix(in srgb, var(--primary) 10%, transparent);
        border-color: var(--primary);
        color: var(--primary);
      }

      .density-pill {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 500;
        border: 1px solid var(--border);
        color: var(--muted-foreground);
        transition: all 150ms;
        cursor: pointer;
        background: transparent;
      }
      .density-pill:hover {
        background: var(--secondary);
      }
      .density-pill--active {
        background: var(--primary);
        color: var(--primary-foreground);
        border-color: var(--primary);
      }
    `,
  ],
})
export class DisplayPopoverComponent {
  viewMode = input.required<ViewMode>();
  density = input<'compact' | 'normal' | 'expanded'>('normal');
  groupBy = input<GroupByMode>('none');
  cardFields = input.required<CardFields>();

  viewModeChanged = output<ViewMode>();
  densityChanged = output<'compact' | 'normal' | 'expanded'>();
  groupByChanged = output<GroupByMode>();
  cardFieldChanged = output<{ key: keyof CardFields; value: boolean }>();
  cardFieldsReset = output<void>();

  readonly displayPopover = viewChild.required<Popover>('displayPopover');

  readonly viewOptions = VIEW_OPTIONS;
  readonly densityOptions = DENSITY_OPTIONS;
  readonly groupByOptions = GROUP_BY_OPTIONS;
  readonly cardFieldOptions = CARD_FIELD_OPTIONS;

  readonly currentViewIcon = computed(() => {
    const opt = VIEW_OPTIONS.find((v) => v.value === this.viewMode());
    return opt?.icon ?? 'pi pi-objects-column';
  });

  readonly currentViewLabel = computed(() => {
    const opt = VIEW_OPTIONS.find((v) => v.value === this.viewMode());
    return opt?.label ?? 'Kanban';
  });

  readonly hasNonDefaultSettings = computed(() => {
    if (this.density() !== 'normal') return true;
    if (this.groupBy() !== 'none') return true;
    const fields = this.cardFields();
    const defaults: (keyof CardFields)[] = [
      'showPriority', 'showDueDate', 'showAssignees', 'showLabels',
      'showSubtaskProgress', 'showComments', 'showAttachments',
      'showTaskId', 'showDescription', 'showDaysInColumn',
    ];
    return defaults.some((key) => !fields[key]);
  });

  onViewSelect(mode: ViewMode): void {
    this.viewModeChanged.emit(mode);
    this.displayPopover().hide();
  }

  onCardFieldToggle(key: keyof CardFields, value: boolean): void {
    this.cardFieldChanged.emit({ key, value });
  }
}

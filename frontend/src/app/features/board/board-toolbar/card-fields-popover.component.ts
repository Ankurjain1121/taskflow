import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { Popover } from 'primeng/popover';
import { Tooltip } from 'primeng/tooltip';
import { FeatureHelpIconComponent } from '../../../shared/components/feature-help-icon/feature-help-icon.component';
import { CardFields } from '../board-view/board-state.service';

export const CARD_FIELD_OPTIONS: { key: keyof CardFields; label: string }[] = [
  { key: 'showPriority', label: 'Priority' },
  { key: 'showDueDate', label: 'Due Date' },
  { key: 'showAssignees', label: 'Assignees' },
  { key: 'showLabels', label: 'Labels' },
  { key: 'showSubtaskProgress', label: 'Subtask Progress' },
  { key: 'showComments', label: 'Comments' },
  { key: 'showAttachments', label: 'Attachments' },
  { key: 'showTaskId', label: 'Task ID' },
  { key: 'showDescription', label: 'Description' },
  { key: 'showDaysInColumn', label: 'Days in Column' },
];

@Component({
  selector: 'app-card-fields-popover',
  standalone: true,
  imports: [CommonModule, ButtonModule, Popover, Tooltip, FeatureHelpIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      (click)="fieldsPopover.toggle($event)"
      class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors"
      pTooltip="Configure card fields"
      tooltipPosition="bottom"
    >
      <i class="pi pi-sliders-v text-xs"></i>
      Fields
    </button>
    <p-popover #fieldsPopover>
      <div class="p-3 min-w-[200px]">
        <div
          class="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2"
        >
          Card Fields
        </div>
        @for (field of cardFieldOptions; track field.key) {
          <label
            class="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-[var(--secondary)] rounded px-1"
          >
            <input
              type="checkbox"
              [checked]="cardFields()[field.key]"
              (change)="onCardFieldToggle(field.key, $any($event.target).checked)"
              class="w-3.5 h-3.5 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            <span class="text-sm text-[var(--foreground)]">{{ field.label }}</span>
          </label>
        }
        <div class="border-t border-[var(--border)] mt-2 pt-2">
          <button
            (click)="cardFieldsReset.emit()"
            class="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </p-popover>
    <app-feature-help-icon
      title="Card Fields"
      description="Show or hide fields on task cards — assignee, priority, due date, labels, and more."
    />
  `,
})
export class CardFieldsPopoverComponent {
  cardFields = input.required<CardFields>();

  cardFieldChanged = output<{ key: keyof CardFields; value: boolean }>();
  cardFieldsReset = output<void>();

  readonly cardFieldOptions = CARD_FIELD_OPTIONS;

  onCardFieldToggle(key: keyof CardFields, value: boolean): void {
    this.cardFieldChanged.emit({ key, value });
  }
}

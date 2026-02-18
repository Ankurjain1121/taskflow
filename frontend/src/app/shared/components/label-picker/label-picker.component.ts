import { Component, inject, input, output, signal, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { Checkbox } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { LabelService, Label } from '../../../core/services/label.service';

@Component({
  selector: 'app-label-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    PopoverModule,
    Checkbox,
  ],
  template: `
    <p-button
      icon="pi pi-tag"
      label="Add label"
      [outlined]="true"
      size="small"
      (onClick)="labelPopover.toggle($event)"
    />

    <p-popover #labelPopover>
      <div class="min-w-[200px]">
        <div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Project Labels
        </div>

        @if (loading()) {
          <div class="px-3 py-2 text-sm text-gray-400">Loading...</div>
        }

        @if (!loading() && labels().length === 0) {
          <div class="px-3 py-2 text-sm text-gray-400">No labels in this project</div>
        }

        @for (label of labels(); track label.id) {
          <div
            class="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded"
            (click)="toggleLabel(label, $event)"
          >
            <p-checkbox
              [binary]="true"
              [ngModel]="isSelected(label.id)"
              [ngModelOptions]="{standalone: true}"
              (click)="$event.stopPropagation()"
              (onChange)="toggleLabel(label, $event)"
            />
            <span class="inline-block w-3 h-3 rounded-full flex-shrink-0"
                  [style.background-color]="label.color"></span>
            <span class="text-sm">{{ label.name }}</span>
          </div>
        }
      </div>
    </p-popover>
  `,
})
export class LabelPickerComponent implements OnInit {
  private labelService = inject(LabelService);

  @ViewChild('labelPopover') labelPopover!: Popover;

  projectId = input.required<string>();
  selectedLabelIds = input<string[]>([]);
  labelToggled = output<{ labelId: string; action: 'add' | 'remove' }>();

  labels = signal<Label[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    this.loadLabels();
  }

  isSelected(labelId: string): boolean {
    return this.selectedLabelIds().includes(labelId);
  }

  toggleLabel(label: Label, event: Event): void {
    event.stopPropagation();
    const action = this.isSelected(label.id) ? 'remove' : 'add';
    this.labelToggled.emit({ labelId: label.id, action });
  }

  private loadLabels(): void {
    this.loading.set(true);
    this.labelService.listByProject(this.projectId()).subscribe({
      next: (labels) => {
        this.labels.set(labels);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}

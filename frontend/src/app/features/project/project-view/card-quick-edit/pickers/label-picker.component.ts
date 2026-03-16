import {
  Component,
  input,
  output,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Label } from '../../../../../core/services/task.service';

@Component({
  selector: 'app-label-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-2">
      <input
        type="text"
        [(ngModel)]="searchQuery"
        placeholder="Search labels..."
        class="w-full px-2 py-1.5 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] mb-2"
      />
      <div
        class="max-h-48 overflow-y-auto space-y-0.5"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Labels"
      >
        @for (label of filteredLabels(); track label.id) {
          <button
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors hover:bg-[var(--muted)]"
            role="option"
            [attr.aria-selected]="isSelected(label.id)"
            (click)="toggle(label.id)"
          >
            <div
              class="w-3 h-3 rounded-sm flex-shrink-0"
              [style.background-color]="label.color"
            ></div>
            <span class="flex-1 text-left text-[var(--foreground)]">{{
              label.name
            }}</span>
            @if (isSelected(label.id)) {
              <svg
                class="w-4 h-4"
                style="color: var(--primary)"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            }
          </button>
        }
        @if (filteredLabels().length === 0) {
          <p
            class="text-xs text-[var(--muted-foreground)] px-2 py-3 text-center"
          >
            No labels found
          </p>
        }
      </div>
    </div>
  `,
})
export class LabelPickerComponent implements OnInit {
  labels = input<Label[]>([]);
  selectedIds = input<string[]>([]);
  labelsChanged = output<string[]>();

  searchQuery = '';
  private selected = signal<Set<string>>(new Set());

  filteredLabels = computed(() => {
    const q = this.searchQuery.toLowerCase();
    const all = this.labels();
    return q ? all.filter((l) => l.name.toLowerCase().includes(q)) : all;
  });

  ngOnInit(): void {
    this.selected.set(new Set(this.selectedIds()));
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  toggle(id: string): void {
    const current = new Set(this.selected());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selected.set(current);
    this.labelsChanged.emit([...current]);
  }
}

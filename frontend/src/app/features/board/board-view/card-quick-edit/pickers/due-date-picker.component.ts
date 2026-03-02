import {
  Component,
  input,
  output,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';

@Component({
  selector: 'app-due-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-3">
      <p-datePicker
        [(ngModel)]="selectedDate"
        [inline]="true"
        [showButtonBar]="false"
        styleClass="w-full"
      />
      <div class="mt-3 flex gap-2">
        <button
          (click)="clearDate()"
          class="flex-1 px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)] rounded hover:bg-[var(--muted)] transition-colors"
        >
          Clear date
        </button>
        <button
          (click)="confirmDate()"
          class="flex-1 px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] bg-[var(--primary)] rounded hover:opacity-90 transition-opacity"
          [disabled]="!selectedDate"
        >
          Set date
        </button>
      </div>
    </div>
  `,
})
export class DueDatePickerComponent implements OnInit {
  currentDate = input<string | null>(null);
  dateSelected = output<string | null>();

  selectedDate: Date | null = null;

  ngOnInit(): void {
    const d = this.currentDate();
    this.selectedDate = d ? new Date(d) : null;
  }

  clearDate(): void {
    this.selectedDate = null;
    this.dateSelected.emit(null);
  }

  confirmDate(): void {
    if (this.selectedDate) {
      this.dateSelected.emit(this.selectedDate.toISOString());
    }
  }
}

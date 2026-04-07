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

      <button
        type="button"
        (click)="toggleTime()"
        class="flex items-center gap-1 mt-2 text-xs text-[var(--primary)] hover:underline"
      >
        <i class="pi pi-clock text-xs"></i>
        {{ showTime ? 'Remove time' : 'Add time' }}
      </button>

      @if (showTime) {
        <div class="mt-2">
          <p-datePicker
            [(ngModel)]="selectedTime"
            [timeOnly]="true"
            [hourFormat]="'12'"
            styleClass="w-full"
          />
        </div>
      }

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
  selectedTime: Date | null = null;
  showTime = false;

  ngOnInit(): void {
    const d = this.currentDate();
    if (d) {
      this.selectedDate = new Date(d);
      const hasTime =
        this.selectedDate.getHours() !== 0 ||
        this.selectedDate.getMinutes() !== 0;
      if (hasTime) {
        this.showTime = true;
        this.selectedTime = new Date(this.selectedDate);
      }
    }
  }

  toggleTime(): void {
    this.showTime = !this.showTime;
    if (!this.showTime) {
      this.selectedTime = null;
    }
  }

  clearDate(): void {
    this.selectedDate = null;
    this.selectedTime = null;
    this.showTime = false;
    this.dateSelected.emit(null);
  }

  confirmDate(): void {
    if (this.selectedDate) {
      const merged = new Date(this.selectedDate);
      if (this.selectedTime) {
        merged.setHours(
          this.selectedTime.getHours(),
          this.selectedTime.getMinutes(),
          0,
          0,
        );
      }
      this.dateSelected.emit(merged.toISOString());
    }
  }
}

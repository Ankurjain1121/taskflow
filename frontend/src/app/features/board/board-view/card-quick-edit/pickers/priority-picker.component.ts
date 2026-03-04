import {
  Component,
  input,
  output,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskPriority } from '../../../../../core/services/task.service';

interface PriorityOption {
  value: TaskPriority | 'none';
  label: string;
  color: string;
}

@Component({
  selector: 'app-priority-picker',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="radiogroup" aria-label="Select priority" class="p-1">
      @for (opt of options; track opt.value) {
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors"
          [class.bg-[var(--muted)]]="current() === opt.value"
          [class.font-medium]="current() === opt.value"
          [class.hover:bg-[var(--muted)]]="current() !== opt.value"
          role="radio"
          [attr.aria-checked]="current() === opt.value"
          (click)="select(opt.value)"
        >
          <span
            class="w-3 h-3 rounded-full flex-shrink-0"
            [style.background-color]="opt.color"
          ></span>
          <span class="text-[var(--foreground)]">{{ opt.label }}</span>
          @if (current() === opt.value) {
            <svg
              class="w-4 h-4 ml-auto"
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
    </div>
  `,
})
export class PriorityPickerComponent implements OnInit {
  currentPriority = input<TaskPriority | null>(null);
  prioritySelected = output<TaskPriority | null>();

  current = signal<TaskPriority | 'none'>('none');

  readonly options: PriorityOption[] = [
    { value: 'none', label: 'No priority', color: '#9ca3af' },
    { value: 'low', label: 'Low', color: '#3b82f6' },
    { value: 'medium', label: 'Medium', color: '#eab308' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  ];

  ngOnInit(): void {
    this.current.set(this.currentPriority() ?? 'none');
  }

  select(value: TaskPriority | 'none'): void {
    this.current.set(value);
    this.prioritySelected.emit(
      value === 'none' ? null : (value as TaskPriority),
    );
  }
}

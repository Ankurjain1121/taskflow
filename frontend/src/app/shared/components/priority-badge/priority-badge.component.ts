import { Component, input, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PRIORITY_COLORS,
  getPriorityLabel,
} from '../../utils/task-colors';
import { TaskPriority } from '../../../core/services/task.service';

@Component({
  selector: 'app-priority-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      [ngClass]="[colorClasses().bg, colorClasses().text]"
    >
      <span
        class="w-1.5 h-1.5 rounded-full"
        [ngClass]="colorClasses().dot"
      ></span>
      {{ label() }}
    </span>
  `,
})
export class PriorityBadgeComponent {
  priority = input.required<TaskPriority | string>();

  colorClasses = computed(() => {
    const p = this.priority().toLowerCase() as TaskPriority;
    return (
      PRIORITY_COLORS[p] || {
        bg: 'bg-gray-400',
        text: 'text-white',
        border: 'border-gray-500',
        dot: 'bg-gray-300',
      }
    );
  });

  label = computed(() => {
    return getPriorityLabel(this.priority());
  });
}

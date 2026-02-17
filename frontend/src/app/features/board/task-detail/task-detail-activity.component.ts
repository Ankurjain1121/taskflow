import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-task-detail-activity',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Comments -->
      <div>
        <div class="flex items-center gap-2 mb-4">
          <i class="pi pi-comments text-gray-400"></i>
          <h3 class="text-sm font-medium text-gray-900">Comments</h3>
        </div>
        <div
          class="bg-gray-50 rounded-md p-4 text-center text-sm text-gray-500"
        >
          Comments will be available in a future update
        </div>
      </div>

      <!-- Attachments -->
      <div>
        <div class="flex items-center gap-2 mb-4">
          <i class="pi pi-paperclip text-gray-400"></i>
          <h3 class="text-sm font-medium text-gray-900">Attachments</h3>
        </div>
        <div
          class="bg-gray-50 rounded-md p-4 text-center text-sm text-gray-500"
        >
          Attachments will be available in a future update
        </div>
      </div>
    </div>
  `,
})
export class TaskDetailActivityComponent {
  taskId = input.required<string>();
}

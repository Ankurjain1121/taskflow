import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-100 p-8">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Notification Settings</h1>
        <p class="text-gray-600">
          Notification settings component - To be implemented
        </p>
      </div>
    </div>
  `,
})
export class NotificationsComponent {}

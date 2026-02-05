import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-100">
      <div class="text-center">
        <h1 class="text-2xl font-bold mb-4">Accept Invitation</h1>
        <p class="text-gray-600">Invitation acceptance component - To be implemented</p>
      </div>
    </div>
  `,
})
export class AcceptInviteComponent {}

import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-100 p-8">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Workspace: {{ workspaceId() }}</h1>
        <p class="text-gray-600">Workspace component - To be implemented</p>
      </div>
    </div>
  `,
})
export class WorkspaceComponent {
  workspaceId = input.required<string>();
}

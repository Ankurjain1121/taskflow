import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-100 p-8">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Board: {{ boardId() }}</h1>
        <p class="text-gray-600">Workspace: {{ workspaceId() }}</p>
        <p class="text-gray-600">Board component - To be implemented</p>
      </div>
    </div>
  `,
})
export class BoardComponent {
  workspaceId = input.required<string>();
  boardId = input.required<string>();
}

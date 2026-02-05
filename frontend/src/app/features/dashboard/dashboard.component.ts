import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-100 p-8">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Dashboard</h1>
        <p class="text-gray-600">Dashboard component - To be implemented</p>
      </div>
    </div>
  `,
})
export class DashboardComponent {}

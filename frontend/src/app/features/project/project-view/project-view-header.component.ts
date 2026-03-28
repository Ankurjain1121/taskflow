import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
@Component({
  selector: 'app-project-view-header',
  standalone: true,
  imports: [RouterModule, Menu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-[var(--card)] border-b border-[var(--border)] px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-[var(--foreground)]">
            {{ boardName() || 'Loading...' }}
          </h1>
          @if (boardDescription()) {
            <p class="text-sm text-[var(--muted-foreground)] mt-1">
              {{ boardDescription() }}
            </p>
          }
        </div>
        <div class="flex items-center gap-3">
          <!-- Automations Button -->
          <a
            [routerLink]="[
              '/workspace',
              workspaceId(),
              'project',
              boardId(),
              'automations',
            ]"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
          >
            <i class="pi pi-bolt w-4 h-4 text-sm" aria-hidden="true"></i>
            Automations
          </a>

          <!-- Settings Button -->
          <a
            [routerLink]="[
              '/workspace',
              workspaceId(),
              'project',
              boardId(),
              'settings',
            ]"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </a>

          <!-- More Menu -->
          <button
            (click)="moreMenu.toggle($event)"
            aria-label="More options"
            class="inline-flex items-center justify-center w-9 h-9 text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
          >
            <i class="pi pi-ellipsis-v text-sm" aria-hidden="true"></i>
          </button>
          <p-menu #moreMenu [popup]="true" [model]="menuItems()" />

          <!-- Add Group Button -->
          <button
            (click)="createGroup.emit()"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] rounded-md hover:bg-[var(--muted)]"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Add Group
          </button>

          <!-- New Task Button -->
          <button
            (click)="createTask.emit()"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] bg-[var(--primary)] rounded-md hover:opacity-90"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Task
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProjectViewHeaderComponent {
  boardName = input('');
  boardDescription = input<string | null>(null);
  workspaceId = input('');
  boardId = input('');
  menuItems = input<MenuItem[]>([]);

  createTask = output<void>();
  createGroup = output<void>();
}

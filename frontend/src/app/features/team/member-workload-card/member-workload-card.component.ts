import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MemberWorkload } from '../../../core/services/team.service';

@Component({
  selector: 'app-member-workload-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [id]="'member-' + member().user_id"
      class="bg-[var(--card)] rounded-lg shadow-sm border p-4 transition-all hover:shadow-md"
      [class.border-orange-400]="member().is_overloaded"
      [class.animate-pulse-border]="member().is_overloaded"
      [class.border-[var(--border)]]="!member().is_overloaded"
    >
      <!-- Header: Avatar + Name -->
      <div class="flex items-center gap-3 mb-4">
        <div
          class="w-10 h-10 rounded-full bg-[var(--secondary)] flex items-center justify-center text-sm font-medium text-[var(--muted-foreground)] overflow-hidden"
        >
          @if (member().user_avatar) {
            <img
              [src]="member().user_avatar"
              [alt]="member().user_name"
              class="w-full h-full object-cover"
            />
          } @else {
            {{ getInitials(member().user_name) }}
          }
        </div>
        <div class="flex-1 min-w-0">
          <h3
            class="text-sm font-semibold text-[var(--card-foreground)] truncate"
          >
            {{ member().user_name }}
          </h3>
          @if (member().is_overloaded) {
            <span
              class="inline-flex items-center gap-1 text-xs font-medium text-orange-600"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              Overloaded
            </span>
          }
        </div>
      </div>

      <!-- Stat Badges -->
      <div class="flex flex-wrap gap-2 mb-4">
        <span
          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
        >
          Active: {{ member().active_tasks }}
        </span>
        <span
          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
          [class.bg-red-100]="member().overdue_tasks > 0"
          [class.text-red-800]="member().overdue_tasks > 0"
          [class.bg-[var(--secondary)]]="member().overdue_tasks === 0"
          [class.text-[var(--muted-foreground)]]="member().overdue_tasks === 0"
        >
          Overdue: {{ member().overdue_tasks }}
        </span>
        <span
          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
        >
          Done: {{ member().done_tasks }}
        </span>
      </div>

      <!-- Progress Bar -->
      <div class="mb-3">
        <div
          class="flex justify-between text-xs text-[var(--muted-foreground)] mb-1"
        >
          <span>Progress</span>
          <span>{{ getProgressPercent() }}%</span>
        </div>
        <div class="w-full bg-[var(--secondary)] rounded-full h-2">
          <div
            class="bg-green-500 h-2 rounded-full transition-all duration-300"
            [style.width.%]="getProgressPercent()"
          ></div>
        </div>
      </div>

      <!-- View Link -->
      <a
        [routerLink]="['/workspace', workspaceId(), 'team', member().user_id]"
        class="text-sm text-primary hover:text-primary font-medium"
      >
        View tasks
      </a>
    </div>
  `,
  styles: [
    `
      @keyframes pulse-border {
        0%,
        100% {
          border-color: rgb(251 146 60);
        }
        50% {
          border-color: rgb(254 215 170);
        }
      }

      .animate-pulse-border {
        animation: pulse-border 2s ease-in-out infinite;
        border-width: 2px;
      }
    `,
  ],
})
export class MemberWorkloadCardComponent {
  member = input.required<MemberWorkload>();
  workspaceId = input.required<string>();

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getProgressPercent(): number {
    const total = this.member().total_tasks;
    if (total === 0) {
      return 0;
    }
    return Math.round((this.member().done_tasks / total) * 100);
  }
}

import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import {
  TeamService,
  OverloadedMember,
} from '../../../core/services/team.service';

@Component({
  selector: 'app-overload-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (overloadedMembers().length > 0) {
      <div
        class="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4 rounded-r-lg"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <svg
              class="w-5 h-5 text-amber-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            <div>
              <p class="text-sm font-medium text-amber-800">
                Workload alert: {{ overloadedMembers().length }} team
                {{
                  overloadedMembers().length === 1 ? 'member is' : 'members are'
                }}
                overloaded
              </p>
              <p class="text-xs text-amber-600 mt-0.5">
                Consider redistributing tasks for better balance
              </p>
            </div>
          </div>
          <button
            (click)="scrollToOverloaded()"
            class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
          >
            Review
          </button>
        </div>
      </div>
    }
  `,
})
export class OverloadBannerComponent implements OnInit, OnDestroy {
  private teamService = inject(TeamService);
  private destroy$ = new Subject<void>();

  workspaceId = input.required<string>();
  threshold = input<number>(10);

  overloadedMembers = signal<OverloadedMember[]>([]);

  ngOnInit(): void {
    this.loadOverloadedMembers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOverloadedMembers(): void {
    this.teamService
      .getOverloadedMembers(this.workspaceId(), this.threshold())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (members) => {
          this.overloadedMembers.set(members);
        },
        error: () => {
          // Banner gracefully degrades — stays hidden when data unavailable
        },
      });
  }

  scrollToOverloaded(): void {
    const firstOverloaded = this.overloadedMembers()[0];
    if (firstOverloaded) {
      const element = document.getElementById(
        `member-${firstOverloaded.user_id}`,
      );
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a temporary highlight effect
        element.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2');
        }, 2000);
      }
    }
  }
}

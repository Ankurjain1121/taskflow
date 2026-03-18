import {
  Component,
  inject,
  input,
  output,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProjectService } from '../../../core/services/project.service';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

@Component({
  selector: 'app-sample-project-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!dismissed()) {
      <div
        class="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-200
               dark:bg-amber-900/20 dark:border-amber-800"
      >
        <div class="flex items-center gap-2">
          <svg
            class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class="text-sm text-amber-800 dark:text-amber-300">
            This is a sample project to help you explore TaskFlow.
          </span>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="deleteBoard()"
            [disabled]="isDeleting()"
            class="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium disabled:opacity-50"
          >
            @if (isDeleting()) {
              Deleting...
            } @else {
              Delete this project
            }
          </button>
          <button
            type="button"
            (click)="dismiss()"
            class="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    }
  `,
})
export class SampleProjectBannerComponent implements OnInit {
  boardId = input.required<string>();
  workspaceId = input.required<string>();

  deleted = output<void>();

  dismissed = signal(false);
  isDeleting = signal(false);

  private wsContext = inject(WorkspaceContextService);

  constructor(
    private router: Router,
    private projectService: ProjectService,
  ) {}

  ngOnInit(): void {
    const key = `tf_sample_banner_dismissed_${this.boardId()}`;
    if (localStorage.getItem(key) === 'true') {
      this.dismissed.set(true);
    }
  }

  dismiss(): void {
    this.dismissed.set(true);
    const key = `tf_sample_banner_dismissed_${this.boardId()}`;
    localStorage.setItem(key, 'true');
  }

  deleteBoard(): void {
    this.isDeleting.set(true);
    this.projectService.deleteBoard(this.boardId()).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.deleted.emit();
        const wsId = this.wsContext.activeWorkspaceId();
        if (wsId) {
          this.router.navigate(['/workspace', wsId, 'dashboard']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: () => {
        this.isDeleting.set(false);
      },
    });
  }
}

import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type EmptyStateVariant =
  | 'board'
  | 'column'
  | 'search'
  | 'tasks'
  | 'generic';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center justify-center py-12 px-8 text-center animate-fade-in-up"
    >
      <!-- SVG Illustration -->
      <div
        class="w-20 h-20 mb-5 rounded-full flex items-center justify-center relative"
        [style.background]="getIllustrationBg()"
      >
        @if (variant() === 'tasks') {
          <div
            class="absolute inset-0 rounded-full animate-pulse"
            style="box-shadow: 0 0 0 6px color-mix(in srgb, var(--success) 8%, transparent)"
          ></div>
        }
        @switch (variant()) {
          @case ('board') {
            <svg
              class="w-10 h-10"
              style="color: var(--primary)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
              />
            </svg>
          }
          @case ('column') {
            <svg
              class="w-10 h-10"
              style="color: var(--primary)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          @case ('search') {
            <svg
              class="w-10 h-10"
              style="color: var(--muted-foreground)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          }
          @case ('tasks') {
            <svg
              class="w-10 h-10"
              style="color: var(--success)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          @default {
            <svg
              class="w-10 h-10"
              style="color: var(--muted-foreground)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 12.677a2.25 2.25 0 00-.1.661z"
              />
            </svg>
          }
        }
      </div>

      <h3 class="text-lg font-semibold" style="color: var(--foreground)">
        {{ title() }}
      </h3>

      @if (description()) {
        <p
          class="text-sm mt-1.5 max-w-sm"
          style="color: var(--muted-foreground)"
        >
          {{ description() }}
        </p>
      }

      @if (subtitle()) {
        <p
          class="text-xs mt-1 max-w-sm"
          style="color: var(--muted-foreground); opacity: 0.7"
        >
          {{ subtitle() }}
        </p>
      }

      @if (ctaLabel()) {
        <button
          class="mt-5 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
          style="background: var(--primary); color: var(--primary-foreground)"
          (click)="ctaClicked.emit()"
        >
          {{ ctaLabel() }}
        </button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  variant = input<EmptyStateVariant>('generic');
  title = input.required<string>();
  description = input<string>('');
  subtitle = input<string>('');
  ctaLabel = input<string>('');
  ctaClicked = output<void>();

  getIllustrationBg(): string {
    switch (this.variant()) {
      case 'board':
        return 'color-mix(in srgb, var(--primary) 10%, transparent)';
      case 'column':
        return 'color-mix(in srgb, var(--primary) 10%, transparent)';
      case 'search':
        return 'var(--muted)';
      case 'tasks':
        return 'color-mix(in srgb, var(--success) 10%, transparent)';
      default:
        return 'var(--muted)';
    }
  }
}

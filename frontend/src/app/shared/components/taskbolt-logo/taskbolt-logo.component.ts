import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-taskbolt-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: 'display: inline-flex',
    class: 'items-center gap-2',
  },
  template: `
    <svg
      [class]="size() === 'sm' ? 'w-5 h-5 shrink-0' : 'w-6 h-6 shrink-0'"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="3" width="20" height="18" rx="3" stroke="var(--primary)" stroke-width="2" />
      <path
        d="M7 12l3 3 7-7"
        stroke="var(--primary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    @if (showText()) {
      <span class="text-base font-bold tracking-tight" style="color: var(--foreground)">TaskBolt</span>
    }
  `,
})
export class TaskboltLogoComponent {
  readonly showText = input(true);
  readonly size = input<'sm' | 'md'>('md');
}

import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';

export type BadgeVariant = 'priority' | 'status' | 'role' | 'accent';
export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low' | 'none';

@Component({
  selector: 'app-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClasses()" [style]="badgeStyles()">
      <ng-content />
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
  `],
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('accent');
  readonly priority = input<PriorityLevel>('none');

  readonly badgeClasses = computed(() => {
    return 'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full leading-tight';
  });

  readonly badgeStyles = computed(() => {
    const v = this.variant();

    if (v === 'priority') {
      return this.priorityStyles();
    }
    if (v === 'status') {
      return 'background: var(--status-blue-bg); color: var(--status-blue-text); border: 1px solid var(--status-blue-border)';
    }
    if (v === 'role') {
      return 'background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary)';
    }
    // accent (default)
    return 'background: var(--muted); color: var(--muted-foreground)';
  });

  private priorityStyles(): string {
    switch (this.priority()) {
      case 'urgent':
        return 'background: var(--status-red-bg); color: var(--status-red-text); border: 1px solid var(--status-red-border)';
      case 'high':
        return 'background: var(--status-amber-bg); color: var(--status-amber-text); border: 1px solid var(--status-amber-border)';
      case 'medium':
        return 'background: var(--status-blue-bg); color: var(--status-blue-text); border: 1px solid var(--status-blue-border)';
      case 'low':
        return 'background: var(--status-blue-bg); color: var(--status-blue-text); border: 1px solid var(--status-blue-border)';
      case 'none':
      default:
        return 'background: var(--muted); color: var(--muted-foreground)';
    }
  }
}

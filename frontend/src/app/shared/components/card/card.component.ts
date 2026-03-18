import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';

export type CardVariant = 'metric' | 'nav' | 'info' | 'form';

@Component({
  selector: 'app-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="hostClasses()" [attr.role]="variant() === 'nav' ? 'button' : undefined">
      <ng-content />
    </div>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class CardComponent {
  readonly variant = input<CardVariant>('info');

  readonly hostClasses = computed(() => {
    const v = this.variant();
    const base = 'rounded-[var(--radius)] transition-all';

    switch (v) {
      case 'metric':
        return `${base} bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-xs)]`;
      case 'nav':
        return `${base} bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow-xs)] cursor-pointer card-nav`;
      case 'form':
        return `${base} bg-[var(--muted)] border border-[var(--border)] p-5`;
      case 'info':
      default:
        return `${base} bg-[var(--card)] border border-[var(--border)] p-5 shadow-[var(--shadow-sm)]`;
    }
  });
}

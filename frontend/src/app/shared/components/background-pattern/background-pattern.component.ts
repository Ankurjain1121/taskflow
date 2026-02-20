import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type BackgroundPattern = 'none' | 'dots' | 'grid' | 'waves';

@Component({
  selector: 'app-background-pattern',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pattern() !== 'none') {
      <div class="background-pattern" [class]="'pattern-' + pattern()"></div>
    }
  `,
  styles: [`
    .background-pattern {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: -1;
      opacity: 0.4;
    }

    .pattern-dots {
      background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
      background-size: 24px 24px;
    }

    .pattern-grid {
      background-image: 
        linear-gradient(var(--border) 1px, transparent 1px),
        linear-gradient(90deg, var(--border) 1px, transparent 1px);
      background-size: 24px 24px;
    }

    .pattern-waves {
      background: 
        radial-gradient(ellipse at 50% 0%, var(--accent) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 100%, var(--accent) 0%, transparent 40%);
      opacity: 0.08;
    }
  `]
})
export class BackgroundPatternComponent {
  pattern = input.required<BackgroundPattern>();
}

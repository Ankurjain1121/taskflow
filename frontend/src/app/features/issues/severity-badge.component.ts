import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IssueSeverity, severityLabel } from '../../shared/types/issue.types';

@Component({
  selector: 'app-severity-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.2rem 0.55rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-weight: 600;
        border: 1px solid transparent;
        line-height: 1;
      }
      .dot {
        width: 0.45rem;
        height: 0.45rem;
        border-radius: 9999px;
      }
      .sev-none {
        background: var(--muted);
        color: var(--muted-foreground);
      }
      .sev-none .dot { background: #9ca3af; }

      .sev-minor {
        background: rgba(59, 130, 246, 0.12);
        color: #2563eb;
      }
      .sev-minor .dot { background: #3b82f6; }

      .sev-major {
        background: rgba(245, 158, 11, 0.15);
        color: #b45309;
      }
      .sev-major .dot { background: #f59e0b; }

      .sev-critical {
        background: rgba(239, 68, 68, 0.15);
        color: #b91c1c;
      }
      .sev-critical .dot { background: #ef4444; }

      .sev-show_stopper {
        background: #7f1d1d;
        color: #fecaca;
      }
      .sev-show_stopper .dot { background: #fecaca; }
    `,
  ],
  template: `
    <span class="badge" [class]="'sev-' + severity()">
      <span class="dot"></span>
      {{ label() }}
    </span>
  `,
})
export class SeverityBadgeComponent {
  severity = input.required<IssueSeverity>();

  label = computed(() => severityLabel(this.severity()));
}

import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-help-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex items-center gap-1.5 text-sm mb-6">
      @for (item of items(); track item.label; let last = $last) {
        @if (item.link && !last) {
          <a [routerLink]="item.link"
             class="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            {{ item.label }}
          </a>
          <i class="pi pi-angle-right text-[var(--muted-foreground)] text-xs"></i>
        } @else {
          <span class="text-[var(--foreground)] font-medium">{{ item.label }}</span>
        }
      }
    </nav>
  `,
})
export class HelpBreadcrumbsComponent {
  items = input.required<readonly BreadcrumbItem[]>();
}

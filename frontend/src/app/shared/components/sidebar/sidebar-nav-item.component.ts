import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-sidebar-nav-item',
  standalone: true,
  imports: [RouterModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }

      .nav-item {
        transition: background var(--duration-fast) var(--ease-standard),
                    color var(--duration-fast) var(--ease-standard);
        position: relative;
        height: 40px;
        border-radius: 0.5rem;
      }
      .nav-item:hover { background: var(--sidebar-surface-hover); }
      .nav-item.active {
        background: var(--sidebar-surface-active);
        color: var(--sidebar-text-primary);
        font-weight: 600;
      }
      .nav-item.active .sidebar-icon-color { color: var(--primary) !important; }

      .collapsed-icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 0.5rem 0;
        transition: background var(--duration-fast) var(--ease-standard);
        border-radius: 0.375rem;
        position: relative;
      }
      .collapsed-icon-btn:hover { background: var(--sidebar-surface-hover); }
      .collapsed-icon-btn.active { background: var(--sidebar-surface-active); }

      .sidebar-icon-color { color: var(--sidebar-text-muted); }
      .sidebar-text { transition: opacity 100ms ease; }
    `,
  ],
  template: `
    @if (collapsed()) {
      <a [routerLink]="route()" routerLinkActive="active"
         [routerLinkActiveOptions]="{exact: exactMatch()}"
         (click)="navClick.emit()" class="collapsed-icon-btn"
         [pTooltip]="label()" tooltipPosition="right">
        <i class="pi {{icon()}} sidebar-icon-color" style="font-size: 1.25rem"></i>
        @if (badge() > 0) {
          <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary"></span>
        }
      </a>
    } @else {
      <a [routerLink]="route()" routerLinkActive="active"
         [routerLinkActiveOptions]="{exact: exactMatch()}"
         (click)="navClick.emit()"
         class="nav-item flex items-center gap-3 px-3 text-sm">
        <i class="pi {{icon()}} flex-shrink-0 sidebar-icon-color" style="font-size: 1.25rem"></i>
        <span class="sidebar-text truncate flex-1 min-w-0" style="color: var(--sidebar-text-secondary)">{{label()}}</span>
        @if (badge() > 0) {
          <span class="ml-auto min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {{ badge() > 99 ? '99+' : badge() }}
          </span>
        }
      </a>
    }
  `,
})
export class SidebarNavItemComponent {
  icon = input.required<string>();
  label = input.required<string>();
  route = input.required<string>();
  badge = input<number>(0);
  collapsed = input<boolean>(false);
  exactMatch = input<boolean>(false);

  navClick = output<void>();
}

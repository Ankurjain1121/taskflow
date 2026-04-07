import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  computed,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';

@Component({
  selector: 'app-sidebar-footer',
  standalone: true,
  imports: [RouterModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }
      .footer-item {
        transition: background var(--duration-fast) var(--ease-standard);
        position: relative;
        height: 40px;
        border-radius: 0.5rem;
      }
      .footer-item:hover { background: var(--sidebar-surface-hover); }
      .footer-item.active {
        background: var(--sidebar-surface-active);
        font-weight: 600;
      }
      .footer-item.active .pi { color: var(--primary) !important; }
      .collapsed-icon-btn {
        display: flex; align-items: center; justify-content: center;
        width: 100%; padding: 0.5rem 0;
        border-radius: 0.375rem;
        transition: background var(--duration-fast) var(--ease-standard);
      }
      .collapsed-icon-btn:hover { background: var(--sidebar-surface-hover); }
      .sidebar-label {
        transition: opacity 200ms ease, max-width 200ms ease;
        overflow: hidden;
        white-space: nowrap;
        opacity: 1;
        max-width: 200px;
      }
      :host-context(.sidebar-collapsed) .sidebar-label {
        opacity: 0;
        max-width: 0;
        pointer-events: none;
      }
    `,
  ],
  template: `
    <div class="flex-shrink-0 px-2 pb-2 relative">
      <div class="h-px mx-1 mb-2" style="background: var(--sidebar-border)"></div>

      <!-- Manage -->
      <a [routerLink]="manageRoute()" routerLinkActive="active"
         class="footer-item flex items-center gap-3 px-3 text-sm"
         [class.justify-center]="collapsed()"
         [pTooltip]="collapsed() ? 'Manage' : ''" tooltipPosition="right">
        <i class="pi pi-cog flex-shrink-0" style="font-size: 1.25rem; color: var(--sidebar-text-muted)"></i>
        <span class="sidebar-label" style="color: var(--sidebar-text-secondary)">Manage</span>
      </a>
      <!-- Help -->
      <a routerLink="/help" routerLinkActive="active"
         class="footer-item flex items-center gap-3 px-3 text-sm"
         [class.justify-center]="collapsed()"
         [pTooltip]="collapsed() ? 'Help' : ''" tooltipPosition="right">
        <i class="pi pi-question-circle flex-shrink-0" style="font-size: 1.25rem; color: var(--sidebar-text-muted)"></i>
        <span class="sidebar-label" style="color: var(--sidebar-text-secondary)">Help</span>
      </a>
    </div>
  `,
})
export class SidebarFooterComponent {
  collapsed = input(false);
  toggleCollapse = output<void>();

  private readonly wsContext = inject(WorkspaceContextService);

  readonly manageRoute = computed(() => {
    const wsId = this.wsContext.activeWorkspaceId();
    return wsId ? `/workspace/${wsId}/manage` : '/manage';
  });
}

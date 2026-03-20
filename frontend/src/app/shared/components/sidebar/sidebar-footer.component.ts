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
      }
      .footer-item:hover { background: var(--sidebar-surface-hover); }
      .footer-item.active { background: var(--sidebar-surface-active); }
      .footer-item.active .nav-indicator { opacity: 1; }
      .nav-indicator {
        position: absolute; left: 0; top: 50%;
        transform: translateY(-50%);
        width: 3px; height: 16px;
        border-radius: 0 3px 3px 0;
        background: var(--primary); opacity: 0;
        transition: opacity var(--duration-fast) var(--ease-standard);
      }
      .collapsed-icon-btn {
        display: flex; align-items: center; justify-content: center;
        width: 100%; padding: 0.5rem 0;
        border-radius: 0.375rem;
        transition: background var(--duration-fast) var(--ease-standard);
      }
      .collapsed-icon-btn:hover { background: var(--sidebar-surface-hover); }
    `,
  ],
  template: `
    <div class="flex-shrink-0 px-2 pb-2 relative">
      <div class="h-px mx-1 mb-2" style="background: var(--sidebar-border)"></div>

      @if (!collapsed()) {
        <!-- Manage -->
        <a [routerLink]="manageRoute()" routerLinkActive="active"
           class="footer-item flex items-center gap-3 px-3 py-2 rounded-md text-sm">
          <span class="nav-indicator"></span>
          <i class="pi pi-cog text-sm flex-shrink-0" style="color: var(--sidebar-text-muted)"></i>
          <span style="color: var(--sidebar-text-secondary)">Manage</span>
        </a>
        <!-- Help -->
        <a routerLink="/help" routerLinkActive="active"
           class="footer-item flex items-center gap-3 px-3 py-2 rounded-md text-sm">
          <span class="nav-indicator"></span>
          <i class="pi pi-question-circle text-sm flex-shrink-0" style="color: var(--sidebar-text-muted)"></i>
          <span style="color: var(--sidebar-text-secondary)">Help</span>
        </a>
      } @else {
        <!-- Collapsed footer -->
        <div class="space-y-0.5">
          <a [routerLink]="manageRoute()" routerLinkActive="active"
             class="collapsed-icon-btn" pTooltip="Manage" tooltipPosition="right">
            <i class="pi pi-cog text-sm" style="color: var(--sidebar-text-muted)"></i>
          </a>
          <a routerLink="/help" routerLinkActive="active"
             class="collapsed-icon-btn" pTooltip="Help" tooltipPosition="right">
            <i class="pi pi-question-circle text-sm" style="color: var(--sidebar-text-muted)"></i>
          </a>
        </div>
      }
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

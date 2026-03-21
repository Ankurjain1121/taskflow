import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { WorkspaceContextService } from '../../../core/services/workspace-context.service';
import {
  CreateWorkspaceDialogComponent,
  CreateWorkspaceDialogResult,
} from '../dialogs/create-workspace-dialog.component';
import { WorkspaceService, Workspace } from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-workspace-switcher',
  standalone: true,
  imports: [RouterModule, TooltipModule, CreateWorkspaceDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }
      .ws-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
      }
      .dropdown-overlay {
        background: var(--card);
        border: 1px solid var(--border);
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      }
      .dropdown-item:hover { background: var(--muted); }
      .ws-btn-sidebar:hover { background: var(--sidebar-surface-hover); }
      .ws-btn-topbar:hover { background: var(--muted); }
    `,
  ],
  template: `
    @if (layout() === 'topbar') {
      <!-- Topbar mode: compact horizontal switcher -->
      <div class="flex items-center relative">
        <button (click)="toggleDropdown(); $event.stopPropagation()"
                class="ws-btn-topbar flex items-center gap-2 min-w-0 rounded-md px-1.5 py-1 transition-colors">
          <span class="ws-avatar w-6 h-6 text-[10px]"
                [style.background]="activeWsColor()">
            {{ activeWsInitial() }}
          </span>
          <span class="text-base font-bold truncate max-w-[120px]"
                style="color: var(--foreground)">
            {{ ctx.activeWorkspace()?.name || 'Workspace' }}
          </span>
          <i class="pi pi-chevron-down text-[10px]"
             style="color: var(--muted-foreground)"></i>
        </button>

        @if (dropdownOpen()) {
          <div class="fixed inset-0 z-10" (click)="dropdownOpen.set(false)"></div>
          <div class="dropdown-overlay absolute top-full left-0 mt-1 z-20 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto min-w-[200px]"
               role="listbox" aria-label="Switch workspace"
               (keydown)="onDropdownKeydown($event)">
            @for (ws of ctx.workspaces(); track ws.id) {
              <button (click)="selectWorkspace(ws.id)"
                      role="option"
                      [attr.aria-selected]="ws.id === ctx.activeWorkspaceId()"
                      class="dropdown-item w-full flex items-center gap-2.5 px-3 py-2 text-sm"
                      style="color: var(--foreground)">
                <span class="ws-avatar w-6 h-6 text-[10px]"
                      [style.background]="ctx.getWorkspaceColor(ws.name)">
                  {{ ws.name.charAt(0).toUpperCase() }}
                </span>
                <div class="flex flex-col min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate">{{ ws.name }}</span>
                    @if (ws.id === ctx.activeWorkspaceId()) {
                      <i class="pi pi-check text-xs text-primary"></i>
                    }
                  </div>
                  <span class="text-[10px]" style="color: var(--muted-foreground)">
                    {{ ws.project_count ?? 0 }} projects · {{ ws.member_count ?? 0 }} members
                  </span>
                </div>
                @if (isOwnerOrAdmin(ws)) {
                  <a [routerLink]="['/workspace', ws.id, 'manage']"
                     (click)="dropdownOpen.set(false); $event.stopPropagation()"
                     class="text-[10px] text-primary hover:brightness-90 ml-auto">
                    Manage →
                  </a>
                }
              </button>
            }
            <div class="h-px mx-2 my-1" style="background: var(--border)"></div>
            <button (click)="onCreateWorkspace()"
                    class="dropdown-item w-full flex items-center gap-2.5 px-3 py-2 text-sm"
                    style="color: var(--muted-foreground)">
              <i class="pi pi-plus text-xs"></i>
              <span>New Workspace</span>
            </button>
          </div>
        }
      </div>
    } @else {
      <!-- Sidebar mode: original layout -->
      <div class="h-14 flex items-center flex-shrink-0 border-b border-[var(--sidebar-border)]"
           [class.px-3]="!collapsed()" [class.px-2]="collapsed()">
        @if (!collapsed()) {
          <div class="flex items-center gap-2.5 w-full relative">
            <button (click)="toggleDropdown(); $event.stopPropagation()"
                    class="ws-btn-sidebar flex items-center gap-2.5 flex-1 min-w-0 rounded-md px-1.5 py-1 transition-colors">
              <span class="ws-avatar w-7 h-7 text-xs"
                    [style.background]="activeWsColor()">
                {{ activeWsInitial() }}
              </span>
              <span class="text-base font-semibold truncate"
                    style="color: var(--sidebar-text-primary)">
                {{ ctx.activeWorkspace()?.name || 'Workspace' }}
              </span>
              <i class="pi pi-chevron-down text-[10px] ml-auto"
                 style="color: var(--sidebar-text-secondary)"></i>
            </button>
            <button (click)="toggleCollapse.emit(); $event.stopPropagation()"
                    class="hidden md:flex items-center justify-center w-7 h-7 rounded-md hover:bg-[var(--sidebar-surface-hover)] transition-colors"
                    style="color: var(--sidebar-text-secondary)"
                    title="Collapse sidebar">
              <i class="pi pi-angle-double-left text-xs"></i>
            </button>

            <!-- Dropdown -->
            @if (dropdownOpen()) {
              <div class="fixed inset-0 z-10" (click)="dropdownOpen.set(false)"></div>
              <div class="dropdown-overlay absolute top-full left-0 right-0 mt-1 z-20 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto"
                   role="listbox" aria-label="Switch workspace"
                   (keydown)="onDropdownKeydown($event)"
                   style="background: var(--sidebar-bg); border-color: var(--sidebar-border)">
                @for (ws of ctx.workspaces(); track ws.id) {
                  <button (click)="selectWorkspace(ws.id)"
                          role="option"
                          [attr.aria-selected]="ws.id === ctx.activeWorkspaceId()"
                          class="dropdown-item w-full flex items-center gap-2.5 px-3 py-2 text-sm"
                          style="color: var(--sidebar-text-secondary)">
                    <span class="ws-avatar w-6 h-6 text-[10px]"
                          [style.background]="ctx.getWorkspaceColor(ws.name)">
                      {{ ws.name.charAt(0).toUpperCase() }}
                    </span>
                    <span class="truncate">{{ ws.name }}</span>
                    @if (ws.id === ctx.activeWorkspaceId()) {
                      <i class="pi pi-check text-xs ml-auto text-primary"></i>
                    }
                  </button>
                }
                <div class="h-px mx-2 my-1" style="background: var(--sidebar-border)"></div>
                <button (click)="onCreateWorkspace()"
                        class="dropdown-item w-full flex items-center gap-2.5 px-3 py-2 text-sm"
                        style="color: var(--sidebar-text-muted)">
                  <i class="pi pi-plus text-xs"></i>
                  <span>New Workspace</span>
                </button>
              </div>
            }
          </div>
        } @else {
          <div class="flex justify-center w-full">
            <button (click)="toggleDropdown()"
                    class="ws-avatar w-8 h-8 text-xs cursor-pointer hover:ring-2 hover:ring-[var(--primary)] transition-all"
                    [pTooltip]="ctx.activeWorkspace()?.name || 'Workspace'"
                    tooltipPosition="right"
                    [style.background]="activeWsColor()">
              {{ activeWsInitial() }}
            </button>
          </div>
        }
      </div>
    }

    <app-create-workspace-dialog
      [(visible)]="showCreateDialog"
      (created)="onWorkspaceCreated($event)"
    />
  `,
})
export class WorkspaceSwitcherComponent implements AfterViewChecked {
  collapsed = input(false);
  layout = input<'sidebar' | 'topbar'>('sidebar');
  toggleCollapse = output<void>();

  readonly ctx = inject(WorkspaceContextService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  dropdownOpen = signal(false);
  showCreateDialog = signal(false);
  private pendingFocusDropdown = false;

  activeWsColor = () => {
    const ws = this.ctx.activeWorkspace();
    return ws ? this.ctx.getWorkspaceColor(ws.name) : '#6366f1';
  };

  activeWsInitial = () => {
    const ws = this.ctx.activeWorkspace();
    return ws ? ws.name.charAt(0).toUpperCase() : 'W';
  };

  ngAfterViewChecked(): void {
    if (this.pendingFocusDropdown && this.dropdownOpen()) {
      this.pendingFocusDropdown = false;
      const el = this.elementRef.nativeElement as HTMLElement;
      const activeOption = el.querySelector<HTMLElement>('button[aria-selected="true"]');
      const firstOption = el.querySelector<HTMLElement>('[role="option"]');
      (activeOption ?? firstOption)?.focus();
    }
  }

  isOwnerOrAdmin(ws: Workspace): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return !!currentUserId && ws.created_by_id === currentUserId;
  }

  toggleDropdown(): void {
    const willOpen = !this.dropdownOpen();
    this.dropdownOpen.set(willOpen);
    if (willOpen) {
      this.pendingFocusDropdown = true;
    }
  }

  onDropdownKeydown(event: KeyboardEvent): void {
    const el = this.elementRef.nativeElement as HTMLElement;
    const options = Array.from(el.querySelectorAll<HTMLElement>('[role="option"]'));
    if (options.length === 0) return;

    const currentIndex = options.findIndex((o) => o === document.activeElement);

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        options[next].focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        options[prev].focus();
        break;
      }
      case 'Enter': {
        event.preventDefault();
        if (currentIndex >= 0) {
          options[currentIndex].click();
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        this.dropdownOpen.set(false);
        break;
      }
    }
  }

  selectWorkspace(wsId: string): void {
    this.dropdownOpen.set(false);
    this.ctx.switchWorkspace(wsId);
  }

  onCreateWorkspace(): void {
    this.dropdownOpen.set(false);
    this.showCreateDialog.set(true);
  }

  onWorkspaceCreated(result: CreateWorkspaceDialogResult): void {
    this.workspaceService.create(result).subscribe({
      next: (workspace) => {
        this.ctx.workspaces.update((ws) => [...ws, workspace]);
        this.router.navigate(['/workspace', workspace.id]);
      },
    });
  }
}

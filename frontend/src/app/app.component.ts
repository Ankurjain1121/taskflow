import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  HostListener,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import {
  trigger,
  transition,
  style,
  animate,
  query,
  group,
} from '@angular/animations';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { ThemeService } from './core/services/theme.service';
import { KeyboardShortcutsService } from './core/services/keyboard-shortcuts.service';
import { WorkspaceContextService } from './core/services/workspace-context.service';
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { TopNavComponent } from './shared/components/top-nav/top-nav.component';
import { WorkspaceSettingsDialogComponent } from './features/workspace/workspace-settings/workspace-settings-dialog.component';
import { TimerWidgetComponent } from './shared/components/timer-widget/timer-widget.component';
import { ViewSwitcherComponent, ViewOption } from './shared/components/view-switcher/view-switcher.component';

const routeTransition = trigger('routeAnimations', [
  transition('* <=> *', [
    query(':enter', [style({ opacity: 0, transform: 'translateY(8px)' })], {
      optional: true,
    }),
    group([
      query(':leave', [animate('150ms ease-out', style({ opacity: 0 }))], {
        optional: true,
      }),
      query(
        ':enter',
        [
          animate(
            '300ms 100ms ease-out',
            style({ opacity: 1, transform: 'translateY(0)' }),
          ),
        ],
        { optional: true },
      ),
    ]),
  ]),
]);

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    ToastModule,
    ToastContainerComponent,
    SidebarComponent,
    TopNavComponent,
    TimerWidgetComponent,
    CommandPaletteComponent,
    WorkspaceSettingsDialogComponent,
    ViewSwitcherComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  animations: [routeTransition],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'frontend';

  searchOpen = signal(false);
  viewSwitcherOpen = signal(false);
  showSidebar = signal(false);

  sidebarCollapsed = signal(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('taskflow_sidebar_collapsed') === 'true'
      : false,
  );

  mobileOpen = signal(false);

  private isMobile = signal(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  private themeService = inject(ThemeService);
  private router = inject(Router);
  private keyboardShortcuts = inject(KeyboardShortcutsService);
  private wsContext = inject(WorkspaceContextService);

  ngOnInit(): void {
    this.registerGlobalShortcuts();

    // Workspace context init is deferred to NavigationEnd so that route guards
    // have resolved — at ngOnInit time, router.url is still '/' before the
    // auth guard redirects to /auth/sign-in, causing a 401 race condition.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = event.url;
        const isAuthPage =
          url.startsWith('/auth') || url.startsWith('/onboarding');
        this.showSidebar.set(!isAuthPage);

        // Initialize workspace context on authenticated pages only
        if (!isAuthPage) {
          if (this.wsContext.workspaces().length === 0) {
            this.wsContext.init(this.extractWorkspaceId(url) ?? undefined);
          }
          // Sync workspace context from URL
          const wsId = this.extractWorkspaceId(url);
          if (wsId) {
            this.wsContext.syncFromUrl(wsId);
          }
        }

        // Close mobile sidebar on navigation
        if (this.mobileOpen()) {
          this.closeMobileSidebar();
        }
      });
  }

  ngOnDestroy(): void {
    this.keyboardShortcuts.unregisterByCategory('Navigation');
  }

  @HostListener('window:resize')
  onResize(): void {
    const mobile = window.innerWidth < 768;
    this.isMobile.set(mobile);
    if (!mobile && this.mobileOpen()) {
      this.closeMobileSidebar();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.searchOpen.set(true);
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'V') {
      event.preventDefault();
      this.viewSwitcherOpen.set(true);
    }
  }

  openSearch(): void {
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
  }

  onToggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileOpen.update((v) => !v);
    } else {
      this.sidebarCollapsed.update((v) => {
        const next = !v;
        localStorage.setItem('taskflow_sidebar_collapsed', String(next));
        return next;
      });
    }
  }

  openMobileSidebar(): void {
    this.mobileOpen.set(true);
  }

  closeMobileSidebar(): void {
    this.mobileOpen.set(false);
  }

  onQuickCreate(): void {
    // Will be connected to task creation dialog in a later feature
  }

  closeViewSwitcher(): void {
    this.viewSwitcherOpen.set(false);
  }

  onViewSelected(view: ViewOption): void {
    this.viewSwitcherOpen.set(false);
    if (view.section === 'workspace') {
      this.navigateToWsRoute(view.id);
    }
    // Project and saved views require project context — handled by the view-switcher consumer
  }

  getSidebarClasses(): string {
    if (this.isMobile()) {
      return this.mobileOpen()
        ? 'sidebar-wrapper fixed left-0 translate-x-0'
        : 'sidebar-wrapper fixed left-0 -translate-x-full';
    }
    return 'relative';
  }

  getRouteAnimationData(outlet: RouterOutlet): string {
    if (!outlet?.isActivated) return '';
    return (
      outlet.activatedRouteData?.['animation'] ||
      outlet.activatedRoute?.snapshot?.url?.toString() ||
      ''
    );
  }

  private extractWorkspaceId(url: string): string | null {
    const match = url.match(/\/workspace\/([^/]+)/);
    return match ? match[1] : null;
  }

  private navigateToWsRoute(path: string): void {
    const wsId = this.wsContext.activeWorkspaceId();
    if (wsId) {
      this.router.navigate(['/workspace', wsId, path]);
    } else {
      this.router.navigate(['/' + path]);
    }
  }

  private registerGlobalShortcuts(): void {
    this.keyboardShortcuts.register('nav-dashboard', {
      prefix: 'g',
      key: 'd',
      description: 'Go to Dashboard',
      category: 'Navigation',
      action: () => this.navigateToWsRoute('dashboard'),
    });

    this.keyboardShortcuts.register('nav-my-tasks', {
      prefix: 'g',
      key: 'm',
      description: 'Go to My Work',
      category: 'Navigation',
      action: () => this.navigateToWsRoute('my-work'),
    });

    this.keyboardShortcuts.register('nav-eisenhower', {
      prefix: 'g',
      key: 'e',
      description: 'Go to Eisenhower Matrix',
      category: 'Navigation',
      action: () => this.navigateToWsRoute('eisenhower'),
    });

    this.keyboardShortcuts.register('nav-inbox', {
      prefix: 'g',
      key: 'i',
      description: 'Go to Inbox',
      category: 'Navigation',
      action: () => this.navigateToWsRoute('inbox'),
    });
  }
}

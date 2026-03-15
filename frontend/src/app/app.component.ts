import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  HostListener,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
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
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { TopNavComponent } from './shared/components/top-nav/top-nav.component';
import { WorkspaceSettingsDialogComponent } from './features/workspace/workspace-settings/workspace-settings-dialog.component';
import { TimerWidgetComponent } from './shared/components/timer-widget/timer-widget.component';

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
    CommandPaletteComponent,
    ToastContainerComponent,
    SidebarComponent,
    TopNavComponent,
    WorkspaceSettingsDialogComponent,
    TimerWidgetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  animations: [routeTransition],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'frontend';

  searchOpen = signal(false);
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

  ngOnInit(): void {
    this.registerGlobalShortcuts();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = event.url;
        const hideSidebar =
          url.startsWith('/auth') || url.startsWith('/onboarding');
        this.showSidebar.set(!hideSidebar);
        // Close mobile sidebar on navigation
        if (this.mobileOpen()) {
          this.closeMobileSidebar();
        }
      });

    const currentUrl = this.router.url;
    const hideSidebar =
      currentUrl.startsWith('/auth') || currentUrl.startsWith('/onboarding');
    this.showSidebar.set(!hideSidebar);
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

  private registerGlobalShortcuts(): void {
    this.keyboardShortcuts.register('nav-dashboard', {
      prefix: 'g',
      key: 'd',
      description: 'Go to Dashboard',
      category: 'Navigation',
      action: () => this.router.navigate(['/dashboard']),
    });

    this.keyboardShortcuts.register('nav-my-tasks', {
      prefix: 'g',
      key: 'm',
      description: 'Go to My Tasks',
      category: 'Navigation',
      action: () => this.router.navigate(['/my-tasks']),
    });

    this.keyboardShortcuts.register('nav-eisenhower', {
      prefix: 'g',
      key: 'e',
      description: 'Go to Eisenhower Matrix',
      category: 'Navigation',
      action: () => this.router.navigate(['/eisenhower']),
    });
  }
}

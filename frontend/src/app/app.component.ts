import { Component, inject, OnInit, HostListener, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { trigger, transition, style, animate, query, group } from '@angular/animations';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ThemeService } from './core/services/theme.service';
import { GlobalSearchComponent } from './shared/components/global-search/global-search.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';

const routeTransition = trigger('routeAnimations', [
  transition('* <=> *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(8px)' }),
    ], { optional: true }),
    group([
      query(':leave', [
        animate('150ms ease-out', style({ opacity: 0 })),
      ], { optional: true }),
      query(':enter', [
        animate('300ms 100ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ], { optional: true }),
    ]),
  ]),
]);

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, GlobalSearchComponent, ToastContainerComponent, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  animations: [routeTransition],
})
export class AppComponent implements OnInit {
  title = 'frontend';

  searchOpen = signal(false);
  showSidebar = signal(false);

  // Inject ThemeService to ensure theme is applied on app initialization
  private themeService = inject(ThemeService);
  private router = inject(Router);

  ngOnInit(): void {
    // ThemeService constructor handles theme initialization
    // This ensures the service is instantiated and theme is applied

    // Listen to route changes to determine if sidebar should be shown
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.url;
        // Hide sidebar on auth and onboarding routes
        const hideSidebar = url.startsWith('/auth') || url.startsWith('/onboarding');
        this.showSidebar.set(!hideSidebar);
      });

    // Set initial sidebar visibility
    const currentUrl = this.router.url;
    const hideSidebar = currentUrl.startsWith('/auth') || currentUrl.startsWith('/onboarding');
    this.showSidebar.set(!hideSidebar);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    // Ctrl+K (Windows/Linux) or Cmd+K (Mac) to open search
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

  getRouteAnimationData(outlet: RouterOutlet): string {
    if (!outlet?.isActivated) return '';
    return outlet.activatedRouteData?.['animation'] || outlet.activatedRoute?.snapshot?.url?.toString() || '';
  }
}

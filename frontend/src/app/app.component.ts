import { Component, inject, OnInit, HostListener, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { GlobalSearchComponent } from './shared/components/global-search/global-search.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlobalSearchComponent, ToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'frontend';

  searchOpen = signal(false);

  // Inject ThemeService to ensure theme is applied on app initialization
  private themeService = inject(ThemeService);

  ngOnInit(): void {
    // ThemeService constructor handles theme initialization
    // This ensures the service is instantiated and theme is applied
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
}

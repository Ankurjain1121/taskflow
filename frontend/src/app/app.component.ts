import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'frontend';

  // Inject ThemeService to ensure theme is applied on app initialization
  private themeService = inject(ThemeService);

  ngOnInit(): void {
    // ThemeService constructor handles theme initialization
    // This ensures the service is instantiated and theme is applied
  }
}

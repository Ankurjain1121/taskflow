import {
  Component,
  inject,
  signal,
  input,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  FavoritesService,
  FavoriteItem,
} from '../../../core/services/favorites.service';

@Component({
  selector: 'app-sidebar-favorites',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!collapsed()) {
      <div class="mb-1">
        <div class="sidebar-section-label">
          <i class="pi pi-star text-xs"></i>
          <span>Favorites</span>
        </div>

        @if (favorites().length === 0) {
          <p class="px-3 py-2 text-xs italic" style="color: var(--sidebar-text-muted)">
            Star boards to pin them here
          </p>
        } @else {
          <div class="space-y-0.5">
            @for (fav of favorites().slice(0, 5); track fav.id) {
              <a
                [routerLink]="getFavLink(fav)"
                routerLinkActive="active"
                class="nav-item flex items-center gap-2 px-3 py-1.5 rounded-md text-sm"
              >
                <i class="pi pi-star-fill text-amber-400/70 text-xs"></i>
                <span class="truncate">{{ fav.name }}</span>
              </a>
            }
          </div>
        }
      </div>
    } @else {
      <div class="flex justify-center py-2" title="Favorites">
        <i class="pi pi-star text-xs" style="color: var(--sidebar-text-muted)"></i>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .nav-item {
      transition: background var(--duration-fast) var(--ease-standard),
                  color var(--duration-fast) var(--ease-standard);
      color: var(--sidebar-text-secondary);
    }
    .nav-item:hover {
      background: var(--sidebar-surface-hover);
    }
    .nav-item.active {
      background: var(--sidebar-surface-active);
      color: var(--sidebar-text-primary);
    }
  `],
})
export class SidebarFavoritesComponent implements OnInit {
  private favoritesService = inject(FavoritesService);

  collapsed = input(false);
  favorites = signal<FavoriteItem[]>([]);

  ngOnInit(): void {
    this.loadFavorites();
  }

  getFavLink(fav: FavoriteItem): string[] {
    if (fav.entity_type === 'board' && fav.workspace_id) {
      return ['/workspace', fav.workspace_id, 'board', fav.entity_id];
    }
    return ['/my-tasks'];
  }

  private loadFavorites(): void {
    this.favoritesService.list().subscribe({
      next: (items) => this.favorites.set(items),
      error: () => {
        // Favorites loading failed silently
      },
    });
  }
}

import { Component, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOffline()) {
      <div
        class="fixed top-14 left-0 right-0 z-45 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
        style="background-color: var(--warning-bg, #fef3c7); color: var(--warning-text, #92400e); z-index: 45;"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <span>You're offline — showing cached data</span>
        <button
          (click)="dismiss()"
          class="ml-2 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss offline notice"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    }
  `,
})
export class OfflineIndicatorComponent implements OnInit, OnDestroy {
  readonly isOffline = signal(false);
  private dismissed = false;

  private readonly onOffline = (): void => {
    this.dismissed = false;
    this.isOffline.set(true);
  };

  private readonly onOnline = (): void => {
    this.isOffline.set(false);
  };

  ngOnInit(): void {
    this.isOffline.set(!navigator.onLine);
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('online', this.onOnline);
  }

  ngOnDestroy(): void {
    window.removeEventListener('offline', this.onOffline);
    window.removeEventListener('online', this.onOnline);
  }

  dismiss(): void {
    this.dismissed = true;
    this.isOffline.set(false);
  }
}

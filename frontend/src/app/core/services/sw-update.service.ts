import { Injectable, inject, DestroyRef } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable({ providedIn: 'root' })
export class SwUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  init(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // Listen for new version ready
    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.messageService.add({
          severity: 'info',
          summary: 'Update Available',
          detail: 'A new version is available. Click to update.',
          sticky: true,
          key: 'sw-update',
          data: { action: 'reload' },
        });
      });

    // Periodically check for updates (for long-lived tabs)
    interval(CHECK_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.swUpdate.checkForUpdate().catch(() => {
          // silently ignore check failures
        });
      });
  }

  reload(): void {
    document.location.reload();
  }
}

import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { SaveStatusService } from '../../../core/services/save-status.service';

@Component({
  selector: 'app-save-status-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
      }

      .save-indicator {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        transition: opacity 0.2s ease;
        color: rgba(255, 255, 255, 0.5);
      }

      .saving {
        color: rgba(255, 255, 255, 0.7);
      }

      .saved {
        color: #0FA882;
      }

      .error {
        color: #E8445A;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .animate-spin {
        animation: spin 1s linear infinite;
      }
    `,
  ],
  template: `
    @switch (saveStatus.state()) {
      @case ('saving') {
        <span class="save-indicator saving">
          <i class="pi pi-spinner animate-spin" style="font-size: 0.7rem"></i>
          Saving...
        </span>
      }
      @case ('saved') {
        <span class="save-indicator saved">
          <i class="pi pi-check" style="font-size: 0.7rem"></i>
          Saved
        </span>
      }
      @case ('error') {
        <span class="save-indicator error">
          <i class="pi pi-exclamation-triangle" style="font-size: 0.7rem"></i>
          Error
        </span>
      }
    }
  `,
})
export class SaveStatusIndicatorComponent {
  readonly saveStatus = inject(SaveStatusService);
}

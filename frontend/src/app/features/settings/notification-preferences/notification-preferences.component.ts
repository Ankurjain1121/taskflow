import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ProfileService,
  NotificationPreference,
  DEFAULT_PREFERENCES,
  EVENT_TYPE_LABELS,
  UpdatePreferenceRequest,
} from '../../../core/services/profile.service';

interface PreferenceRow {
  eventType: string;
  label: string;
  inApp: boolean;
  email: boolean;
  slack: boolean;
  whatsapp: boolean;
}

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTableModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatTooltipModule,
  ],
  template: `
    <div class="min-h-screen bg-gray-100 p-4 md:p-8">
      <div class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="mb-6">
          <div class="flex items-center gap-2 mb-2">
            <a routerLink="/settings/profile" class="text-gray-500 hover:text-gray-700">
              <mat-icon>arrow_back</mat-icon>
            </a>
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900">Notification Preferences</h1>
          </div>
          <p class="text-gray-600">
            Choose how you want to be notified for different events
          </p>
        </div>

        <!-- Loading state -->
        <div *ngIf="isLoading()" class="flex items-center justify-center py-12">
          <mat-spinner diameter="40"></mat-spinner>
        </div>

        <!-- Preferences table -->
        <mat-card *ngIf="!isLoading()" class="overflow-hidden">
          <div class="overflow-x-auto">
            <table mat-table [dataSource]="preferenceRows()" class="w-full">
              <!-- Event Type Column -->
              <ng-container matColumnDef="eventType">
                <th mat-header-cell *matHeaderCellDef class="!font-semibold">Event Type</th>
                <td mat-cell *matCellDef="let row" class="!py-4">
                  {{ row.label }}
                </td>
              </ng-container>

              <!-- In-App Column -->
              <ng-container matColumnDef="inApp">
                <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-center">In-App</th>
                <td mat-cell *matCellDef="let row" class="!text-center">
                  <mat-slide-toggle
                    [checked]="row.inApp"
                    [disabled]="true"
                    matTooltip="In-app notifications are always enabled"
                  ></mat-slide-toggle>
                </td>
              </ng-container>

              <!-- Email Column -->
              <ng-container matColumnDef="email">
                <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-center">Email</th>
                <td mat-cell *matCellDef="let row" class="!text-center">
                  <mat-slide-toggle
                    [checked]="row.email"
                    (change)="onToggleChange(row.eventType, 'email', $event)"
                  ></mat-slide-toggle>
                </td>
              </ng-container>

              <!-- Slack Column -->
              <ng-container matColumnDef="slack" *ngIf="slackEnabled()">
                <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-center">Slack</th>
                <td mat-cell *matCellDef="let row" class="!text-center">
                  <mat-slide-toggle
                    [checked]="row.slack"
                    (change)="onToggleChange(row.eventType, 'slack', $event)"
                  ></mat-slide-toggle>
                </td>
              </ng-container>

              <!-- WhatsApp Column -->
              <ng-container matColumnDef="whatsapp" *ngIf="whatsappEnabled()">
                <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-center">WhatsApp</th>
                <td mat-cell *matCellDef="let row" class="!text-center">
                  <mat-slide-toggle
                    [checked]="row.whatsapp"
                    (change)="onToggleChange(row.eventType, 'whatsapp', $event)"
                  ></mat-slide-toggle>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
            </table>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-4 p-4 border-t bg-gray-50">
            <button
              mat-button
              color="warn"
              (click)="resetToDefaults()"
              [disabled]="isSaving()"
            >
              <mat-icon>refresh</mat-icon>
              Reset to Defaults
            </button>
          </div>
        </mat-card>

        <!-- Help text -->
        <div class="mt-6 text-sm text-gray-500">
          <p class="flex items-center gap-2">
            <mat-icon class="text-blue-500 !text-base">info</mat-icon>
            In-app notifications cannot be disabled to ensure you always receive important updates.
          </p>
          <p *ngIf="!slackEnabled() || !whatsappEnabled()" class="flex items-center gap-2 mt-2">
            <mat-icon class="text-gray-400 !text-base">visibility_off</mat-icon>
            Some notification channels may be hidden if not configured for your organization.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .mat-mdc-table {
        background: transparent;
      }

      :host ::ng-deep .mat-mdc-row:hover {
        background-color: rgba(0, 0, 0, 0.02);
      }
    `,
  ],
})
export class NotificationPreferencesComponent implements OnInit {
  // Feature flags - in real app these would come from environment/config service
  slackEnabled = signal(true);
  whatsappEnabled = signal(true);

  isLoading = signal(true);
  isSaving = signal(false);

  private preferencesMap = signal<Map<string, PreferenceRow>>(new Map());

  displayedColumns = computed(() => {
    const cols = ['eventType', 'inApp', 'email'];
    if (this.slackEnabled()) cols.push('slack');
    if (this.whatsappEnabled()) cols.push('whatsapp');
    return cols;
  });

  preferenceRows = computed(() => {
    const eventTypes = Object.keys(DEFAULT_PREFERENCES);
    return eventTypes.map((eventType) => {
      const saved = this.preferencesMap().get(eventType);
      if (saved) {
        return saved;
      }
      // Use defaults
      const defaults = DEFAULT_PREFERENCES[eventType];
      return {
        eventType,
        label: EVENT_TYPE_LABELS[eventType] || eventType,
        inApp: defaults.in_app,
        email: defaults.email,
        slack: defaults.slack,
        whatsapp: defaults.whatsapp,
      };
    });
  });

  constructor(
    private profileService: ProfileService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPreferences();
  }

  private loadPreferences(): void {
    this.isLoading.set(true);
    this.profileService.getNotificationPreferences().subscribe({
      next: (preferences) => {
        const map = new Map<string, PreferenceRow>();
        preferences.forEach((pref) => {
          map.set(pref.event_type, {
            eventType: pref.event_type,
            label: EVENT_TYPE_LABELS[pref.event_type] || pref.event_type,
            inApp: pref.in_app,
            email: pref.email,
            slack: pref.slack,
            whatsapp: pref.whatsapp,
          });
        });
        this.preferencesMap.set(map);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load preferences:', error);
        this.snackBar.open('Failed to load preferences', 'Dismiss', {
          duration: 3000,
        });
        this.isLoading.set(false);
      },
    });
  }

  onToggleChange(
    eventType: string,
    channel: 'email' | 'slack' | 'whatsapp',
    event: MatSlideToggleChange
  ): void {
    const currentRow = this.preferenceRows().find((r) => r.eventType === eventType);
    if (!currentRow) return;

    const request: UpdatePreferenceRequest = {
      eventType,
      inApp: true, // Always true
      email: channel === 'email' ? event.checked : currentRow.email,
      slack: channel === 'slack' ? event.checked : currentRow.slack,
      whatsapp: channel === 'whatsapp' ? event.checked : currentRow.whatsapp,
    };

    this.isSaving.set(true);
    this.profileService.updateNotificationPreference(request).subscribe({
      next: (updatedPref) => {
        // Update local state
        const map = new Map(this.preferencesMap());
        map.set(updatedPref.event_type, {
          eventType: updatedPref.event_type,
          label: EVENT_TYPE_LABELS[updatedPref.event_type] || updatedPref.event_type,
          inApp: updatedPref.in_app,
          email: updatedPref.email,
          slack: updatedPref.slack,
          whatsapp: updatedPref.whatsapp,
        });
        this.preferencesMap.set(map);
        this.isSaving.set(false);
      },
      error: (error) => {
        console.error('Failed to update preference:', error);
        this.snackBar.open('Failed to update preference', 'Dismiss', {
          duration: 3000,
        });
        this.isSaving.set(false);
        // Revert the toggle
        event.source.checked = !event.checked;
      },
    });
  }

  resetToDefaults(): void {
    if (!confirm('Are you sure you want to reset all notification preferences to defaults?')) {
      return;
    }

    this.isSaving.set(true);
    this.profileService.resetNotificationPreferences().subscribe({
      next: () => {
        this.preferencesMap.set(new Map());
        this.snackBar.open('Preferences reset to defaults', 'Dismiss', {
          duration: 3000,
        });
        this.isSaving.set(false);
      },
      error: (error) => {
        console.error('Failed to reset preferences:', error);
        this.snackBar.open('Failed to reset preferences', 'Dismiss', {
          duration: 3000,
        });
        this.isSaving.set(false);
      },
    });
  }
}

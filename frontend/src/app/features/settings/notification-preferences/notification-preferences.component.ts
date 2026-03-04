import {
  Component,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';

import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Tooltip } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    TableModule,
    ToggleSwitch,
    ButtonModule,
    ProgressSpinner,
    Tooltip,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="min-h-screen bg-[var(--secondary)] p-4 md:p-8">
      <div class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="mb-6">
          <div class="flex items-center gap-2 mb-2">
            <a
              routerLink="/settings/profile"
              class="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <i class="pi pi-arrow-left"></i>
            </a>
            <h1
              class="text-2xl md:text-3xl font-bold text-[var(--card-foreground)]"
            >
              Notification Preferences
            </h1>
          </div>
          <p class="text-[var(--muted-foreground)]">
            Choose how you want to be notified for different events
          </p>
        </div>

        <!-- Loading state -->
        @if (isLoading()) {
          <div class="flex items-center justify-center py-12">
            <p-progressSpinner
              [style]="{ width: '40px', height: '40px' }"
              strokeWidth="4"
            />
          </div>
        }

        <!-- Preferences table -->
        @if (!isLoading()) {
          <div
            class="bg-[var(--card)] rounded-lg border border-[var(--border)] shadow-sm overflow-hidden"
          >
            <p-table
              [value]="preferenceRows()"
              styleClass="p-datatable-sm"
              [tableStyle]="{ 'min-width': '50rem' }"
            >
              <ng-template pTemplate="header">
                <tr>
                  <th class="!font-semibold">Event Type</th>
                  <th class="!font-semibold !text-center">In-App</th>
                  <th class="!font-semibold !text-center">Email</th>
                  @if (slackEnabled()) {
                    <th class="!font-semibold !text-center">Slack</th>
                  }
                  @if (whatsappEnabled()) {
                    <th class="!font-semibold !text-center">WhatsApp</th>
                  }
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-row>
                <tr>
                  <td class="!py-4">{{ row.label }}</td>
                  <td class="!text-center">
                    <p-toggleSwitch
                      [(ngModel)]="row.inApp"
                      [disabled]="true"
                      pTooltip="In-app notifications are always enabled"
                    />
                  </td>
                  <td class="!text-center">
                    <p-toggleSwitch
                      [(ngModel)]="row.email"
                      (onChange)="
                        onToggleChange(row.eventType, 'email', $event.checked)
                      "
                    />
                  </td>
                  @if (slackEnabled()) {
                    <td class="!text-center">
                      <p-toggleSwitch
                        [(ngModel)]="row.slack"
                        (onChange)="
                          onToggleChange(row.eventType, 'slack', $event.checked)
                        "
                      />
                    </td>
                  }
                  @if (whatsappEnabled()) {
                    <td class="!text-center">
                      <p-toggleSwitch
                        [(ngModel)]="row.whatsapp"
                        (onChange)="
                          onToggleChange(
                            row.eventType,
                            'whatsapp',
                            $event.checked
                          )
                        "
                      />
                    </td>
                  }
                </tr>
              </ng-template>
            </p-table>

            <!-- Actions -->
            <div
              class="flex justify-end gap-4 p-4 border-t bg-[var(--secondary)]"
            >
              <p-button
                severity="danger"
                [text]="true"
                (onClick)="resetToDefaults()"
                [disabled]="isSaving()"
                icon="pi pi-refresh"
                label="Reset to Defaults"
              />
            </div>
          </div>
        }

        <!-- Help text -->
        <div class="mt-6 text-sm text-[var(--muted-foreground)]">
          <p class="flex items-center gap-2">
            <i class="pi pi-info-circle text-blue-500"></i>
            In-app notifications cannot be disabled to ensure you always receive
            important updates.
          </p>
          @if (!slackEnabled() || !whatsappEnabled()) {
            <p class="flex items-center gap-2 mt-2">
              <i class="pi pi-eye-slash text-gray-400"></i>
              Some notification channels may be hidden if not configured for
              your organization.
            </p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
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
    private messageService: MessageService,
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
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load preferences',
        });
        this.isLoading.set(false);
      },
    });
  }

  onToggleChange(
    eventType: string,
    channel: 'email' | 'slack' | 'whatsapp',
    checked: boolean,
  ): void {
    const currentRow = this.preferenceRows().find(
      (r) => r.eventType === eventType,
    );
    if (!currentRow) return;

    const request: UpdatePreferenceRequest = {
      eventType,
      inApp: true, // Always true
      email: channel === 'email' ? checked : currentRow.email,
      slack: channel === 'slack' ? checked : currentRow.slack,
      whatsapp: channel === 'whatsapp' ? checked : currentRow.whatsapp,
    };

    this.isSaving.set(true);
    this.profileService.updateNotificationPreference(request).subscribe({
      next: (updatedPref) => {
        // Update local state
        const map = new Map(this.preferencesMap());
        map.set(updatedPref.event_type, {
          eventType: updatedPref.event_type,
          label:
            EVENT_TYPE_LABELS[updatedPref.event_type] || updatedPref.event_type,
          inApp: updatedPref.in_app,
          email: updatedPref.email,
          slack: updatedPref.slack,
          whatsapp: updatedPref.whatsapp,
        });
        this.preferencesMap.set(map);
        this.isSaving.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to update preference',
        });
        this.isSaving.set(false);
      },
    });
  }

  resetToDefaults(): void {
    if (
      !confirm(
        'Are you sure you want to reset all notification preferences to defaults?',
      )
    ) {
      return;
    }

    this.isSaving.set(true);
    this.profileService.resetNotificationPreferences().subscribe({
      next: () => {
        this.preferencesMap.set(new Map());
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Preferences reset to defaults',
        });
        this.isSaving.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to reset preferences',
        });
        this.isSaving.set(false);
      },
    });
  }
}

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinner } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import {
  ProfileService,
  DEFAULT_PREFERENCES,
  EVENT_TYPE_LABELS,
  UpdatePreferenceRequest,
} from '../../../core/services/profile.service';
import { UserPreferencesService } from '../../../core/services/user-preferences.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';

interface PreferenceRow {
  eventType: string;
  label: string;
  inApp: boolean;
  email: boolean;
  slack: boolean;
  whatsapp: boolean;
}

@Component({
  selector: 'app-notifications-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TableModule,
    ToggleSwitch,
    ButtonModule,
    RadioButtonModule,
    TooltipModule,
    ToastModule,
    ProgressSpinner,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <!-- Desktop / Browser Notifications -->
    <div
      class="rounded-lg border shadow-sm p-6 mb-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <div class="flex items-start justify-between mb-3">
        <div>
          <h2
            class="text-xl font-semibold mb-1"
            style="color: var(--foreground)"
          >
            Desktop Notifications
          </h2>
          <p class="text-sm" style="color: var(--muted-foreground)">
            Get notified about assignments and mentions even when TaskBolt isn't
            your active tab.
          </p>
        </div>
        @if (pushService.permission() === 'granted') {
          <span
            class="px-2 py-1 text-xs font-medium rounded-full ml-4 shrink-0"
            style="background: color-mix(in srgb, var(--success) 15%, var(--card)); color: var(--success)"
            >Enabled</span
          >
        } @else if (pushService.permission() === 'denied') {
          <span
            class="px-2 py-1 text-xs font-medium rounded-full ml-4 shrink-0"
            style="background: color-mix(in srgb, var(--destructive) 15%, var(--card)); color: var(--destructive)"
            >Blocked</span
          >
        } @else {
          <span
            class="px-2 py-1 text-xs font-medium rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] ml-4 shrink-0"
            >Not set up</span
          >
        }
      </div>
      @if (!pushService.isSupported) {
        <p class="text-sm" style="color: var(--muted-foreground)">
          <i class="pi pi-exclamation-triangle mr-1" style="color: var(--accent-warm)"></i>
          Your browser does not support desktop notifications.
        </p>
      } @else if (pushService.permission() === 'granted') {
        <p
          class="text-sm flex items-center gap-2"
          style="color: var(--muted-foreground)"
        >
          <i class="pi pi-check-circle" style="color: var(--success)"></i>
          Desktop notifications are active.
        </p>
      } @else if (pushService.permission() === 'denied') {
        <p
          class="text-sm flex items-center gap-2"
          style="color: var(--muted-foreground)"
        >
          <i class="pi pi-info-circle" style="color: var(--accent-warm)"></i>
          Notifications are blocked. Enable them in your browser settings, then
          refresh this page.
        </p>
      } @else {
        <p-button
          label="Enable Desktop Notifications"
          icon="pi pi-bell"
          severity="secondary"
          (onClick)="enablePushNotifications()"
        />
      }
    </div>

    <!-- Notification Channels Table -->
    <div
      class="rounded-lg border shadow-sm mb-6 overflow-hidden"
      style="background: var(--card); border-color: var(--border)"
    >
      <div class="p-6 pb-2">
        <h2 class="text-xl font-semibold mb-1" style="color: var(--foreground)">
          Notification Channels
        </h2>
        <p class="text-sm" style="color: var(--muted-foreground)">
          Choose how you want to be notified for different events
        </p>
      </div>

      @if (isLoading()) {
        <div class="flex items-center justify-center py-12">
          <p-progressSpinner
            [style]="{ width: '40px', height: '40px' }"
            strokeWidth="4"
          />
        </div>
      }

      @if (!isLoading()) {
        <p-table
          [value]="preferenceRows()"
          styleClass="p-datatable-sm"
          [tableStyle]="{ 'min-width': '40rem' }"
        >
          <ng-template pTemplate="header">
            <tr>
              <th scope="col" class="!font-semibold">Event</th>
              <th scope="col" class="!font-semibold !text-center">In-App</th>
              <th scope="col" class="!font-semibold !text-center">Email</th>
              <th scope="col" class="!font-semibold !text-center">
                <span
                  pTooltip="Slack integration coming soon"
                  tooltipPosition="top"
                  class="cursor-help"
                >
                  Slack
                  <i
                    class="pi pi-lock text-xs ml-1"
                    style="color: var(--muted-foreground)"
                  ></i>
                </span>
              </th>
              <th scope="col" class="!font-semibold !text-center">
                <span class="flex items-center justify-center gap-1">
                  <i class="pi pi-whatsapp text-xs" style="color: var(--success)"></i>
                  WhatsApp
                </span>
              </th>
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
              <td class="!text-center">
                <p-toggleSwitch
                  [(ngModel)]="row.slack"
                  [disabled]="true"
                  pTooltip="Coming soon"
                />
              </td>
              <td class="!text-center">
                <p-toggleSwitch
                  [(ngModel)]="row.whatsapp"
                  [disabled]="!hasPhoneNumber()"
                  [pTooltip]="hasPhoneNumber() ? '' : 'Add your phone number in Profile to enable WhatsApp'"
                  (onChange)="onToggleChange(row.eventType, 'whatsapp', $event.checked)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>

        <div
          class="flex justify-end gap-4 p-4 border-t"
          style="background: var(--secondary); border-color: var(--border)"
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
      }
    </div>

    <!-- Quiet Hours -->
    <div
      class="rounded-lg border shadow-sm p-6 mb-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <h2 class="text-xl font-semibold mb-1" style="color: var(--foreground)">
        Quiet Hours
      </h2>
      <p class="text-sm mb-4" style="color: var(--muted-foreground)">
        Pause non-critical notifications during these hours
      </p>

      <div class="flex items-center gap-3 mb-4">
        <p-toggleSwitch
          [ngModel]="quietHoursEnabled()"
          (ngModelChange)="quietHoursEnabled.set($event)"
        />
        <label class="text-sm font-medium" style="color: var(--foreground)">
          Enable quiet hours
        </label>
      </div>
      @if (quietHoursEnabled()) {
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium" style="color: var(--foreground)">
              Start Time
            </label>
            <input
              type="time"
              [(ngModel)]="quietHoursStart"
              class="px-3 py-2 rounded-lg border text-sm"
              style="
                background: var(--secondary);
                border-color: var(--border);
                color: var(--foreground);
              "
            />
          </div>
          <span class="text-sm mt-6" style="color: var(--muted-foreground)"
            >to</span
          >
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium" style="color: var(--foreground)">
              End Time
            </label>
            <input
              type="time"
              [(ngModel)]="quietHoursEnd"
              class="px-3 py-2 rounded-lg border text-sm"
              style="
                background: var(--secondary);
                border-color: var(--border);
                color: var(--foreground);
              "
            />
          </div>
        </div>
      }
    </div>

    <!-- Digest Frequency -->
    <div
      class="rounded-lg border shadow-sm p-6 mb-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <h2 class="text-xl font-semibold mb-1" style="color: var(--foreground)">
        Digest Frequency
      </h2>
      <p class="text-sm mb-4" style="color: var(--muted-foreground)">
        How often should we bundle email notifications
      </p>

      <div class="flex gap-6">
        @for (option of digestOptions; track option.value) {
          <div class="flex items-center gap-2">
            <p-radioButton
              name="digestFrequency"
              [value]="option.value"
              [(ngModel)]="digestFrequency"
            />
            <label class="text-sm" style="color: var(--foreground)">
              {{ option.label }}
            </label>
          </div>
        }
      </div>
    </div>

    <!-- Save Extra Settings -->
    <div class="flex justify-end">
      <p-button
        label="Save Notification Settings"
        icon="pi pi-check"
        [loading]="isSavingExtra()"
        [disabled]="isSavingExtra()"
        (onClick)="saveExtraSettings()"
      />
    </div>

    <!-- Help text -->
    <div class="mt-6 text-sm" style="color: var(--muted-foreground)">
      <p class="flex items-center gap-2">
        <i class="pi pi-info-circle" style="color: var(--primary)"></i>
        In-app notifications cannot be disabled to ensure you always receive
        important updates.
      </p>
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
export class NotificationsSectionComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly userPreferencesService = inject(UserPreferencesService);
  private readonly messageService = inject(MessageService);
  readonly pushService = inject(PushNotificationService);

  hasPhoneNumber = signal(false);
  isLoading = signal(true);
  isSaving = signal(false);
  isSavingExtra = signal(false);

  quietHoursStart = '22:00';
  quietHoursEnd = '08:00';
  digestFrequency = 'realtime';
  quietHoursEnabled = signal<boolean>(false);

  digestOptions = [
    { label: 'Realtime', value: 'realtime' },
    { label: 'Hourly', value: 'hourly' },
    { label: 'Daily', value: 'daily' },
  ];

  private preferencesMap = signal<Map<string, PreferenceRow>>(new Map());

  preferenceRows = computed(() => {
    const eventTypes = Object.keys(DEFAULT_PREFERENCES);
    return eventTypes.map((eventType) => {
      const saved = this.preferencesMap().get(eventType);
      if (saved) {
        return saved;
      }
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

  ngOnInit(): void {
    this.loadNotificationPreferences();
    this.loadExtraSettings();
    this.checkPhoneNumber();
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
      inApp: true,
      email: channel === 'email' ? checked : currentRow.email,
      slack: channel === 'slack' ? checked : currentRow.slack,
      whatsapp: channel === 'whatsapp' ? checked : currentRow.whatsapp,
    };

    this.isSaving.set(true);
    this.profileService.updateNotificationPreference(request).subscribe({
      next: (updatedPref) => {
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

  enablePushNotifications(): void {
    this.pushService.requestPermission();
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

  saveExtraSettings(): void {
    this.isSavingExtra.set(true);
    this.userPreferencesService
      .updatePreferences({
        quiet_hours_start: this.quietHoursEnabled() ? this.quietHoursStart : '',
        quiet_hours_end: this.quietHoursEnabled() ? this.quietHoursEnd : '',
        digest_frequency: this.digestFrequency,
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Notification settings updated',
          });
          this.isSavingExtra.set(false);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to save notification settings',
          });
          this.isSavingExtra.set(false);
        },
      });
  }

  private loadNotificationPreferences(): void {
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
          detail: 'Failed to load notification preferences',
        });
        this.isLoading.set(false);
      },
    });
  }

  private checkPhoneNumber(): void {
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.hasPhoneNumber.set(!!profile.phone_number);
      },
      error: () => {
        this.hasPhoneNumber.set(false);
      },
    });
  }

  private loadExtraSettings(): void {
    this.userPreferencesService.getPreferences().subscribe({
      next: (prefs) => {
        if (prefs) {
          this.quietHoursStart = prefs.quiet_hours_start || '22:00';
          this.quietHoursEnd = prefs.quiet_hours_end || '08:00';
          this.quietHoursEnabled.set(!!prefs.quiet_hours_start);
          this.digestFrequency = prefs.digest_frequency || 'realtime';
        }
      },
      error: () => {
        // Keep defaults on error
      },
    });
  }
}

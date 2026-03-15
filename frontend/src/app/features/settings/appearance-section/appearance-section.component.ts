import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ThemeService,
  Theme,
  AccentColor,
  ACCENT_PRESETS,
} from '../../../core/services/theme.service';
import { UserPreferencesService } from '../../../core/services/user-preferences.service';

interface TimezoneOption {
  label: string;
  value: string;
}

interface DateFormatOption {
  label: string;
  value: string;
}

interface BoardViewOption {
  label: string;
  value: string;
}


@Component({
  selector: 'app-appearance-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    SelectModule,
    RadioButtonModule,
    TooltipModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <!-- Theme Selection -->
    <div
      class="rounded-lg border shadow-sm p-6 mb-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <h2 class="text-xl font-semibold mb-1" style="color: var(--foreground)">
        Theme
      </h2>
      <p class="text-sm mb-4" style="color: var(--muted-foreground)">
        Choose your preferred theme
      </p>

      <!-- Section A: Color Mode -->
      <div class="flex gap-3">
        @for (option of themeOptions; track option.value) {
          <button
            (click)="setTheme(option.value)"
            class="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer flex-1"
            [style.border-color]="
              currentTheme() === option.value
                ? 'var(--primary)'
                : 'var(--border)'
            "
            [style.background]="
              currentTheme() === option.value ? 'var(--muted)' : 'transparent'
            "
          >
            <i
              [class]="option.icon + ' text-xl'"
              [style.color]="
                currentTheme() === option.value
                  ? 'var(--primary)'
                  : 'var(--muted-foreground)'
              "
            ></i>
            <span
              class="text-sm font-medium"
              [style.color]="
                currentTheme() === option.value
                  ? 'var(--primary)'
                  : 'var(--foreground)'
              "
              >{{ option.label }}</span
            >
          </button>
        }
      </div>

      <!-- Section B: Theme Gallery -->
      <!-- Section B: Accent Color -->
      <div class="mt-4 pt-4" style="border-top: 1px solid var(--border)">
        <p class="text-sm font-medium mb-3" style="color: var(--foreground)">
          Accent Color
        </p>
        <div class="flex gap-3 flex-wrap">
          @for (a of accentPresets; track a.value) {
            <button
              (click)="setAccent(a.value)"
              class="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
              [style.background]="a.color"
              [style.border-color]="
                currentAccent() === a.value
                  ? 'var(--foreground)'
                  : 'transparent'
              "
              [style.transform]="
                currentAccent() === a.value ? 'scale(1.15)' : 'scale(1)'
              "
              [pTooltip]="a.label"
              tooltipPosition="bottom"
            >
              @if (currentAccent() === a.value) {
                <i class="pi pi-check text-white text-xs"></i>
              }
            </button>
          }
        </div>
      </div>
    </div>

    <!-- Preferences Section -->
    <div
      class="rounded-lg border shadow-sm p-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <h2 class="text-xl font-semibold mb-1" style="color: var(--foreground)">
        Preferences
      </h2>
      <p class="text-sm mb-5" style="color: var(--muted-foreground)">
        Customize your workspace experience
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Timezone -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium" style="color: var(--foreground)">
            Timezone
          </label>
          <p-select
            [options]="timezoneOptions"
            [(ngModel)]="preferences.timezone"
            optionLabel="label"
            optionValue="value"
            placeholder="Select timezone"
            class="w-full"
            [filter]="true"
            filterPlaceholder="Search timezones..."
          />
        </div>

        <!-- Date Format -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium" style="color: var(--foreground)">
            Date Format
          </label>
          <p-select
            [options]="dateFormatOptions"
            [(ngModel)]="preferences.dateFormat"
            optionLabel="label"
            optionValue="value"
            placeholder="Select date format"
            class="w-full"
          />
        </div>

        <!-- Default Board View -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium" style="color: var(--foreground)">
            Default Project View
          </label>
          <p-select
            [options]="boardViewOptions"
            [(ngModel)]="preferences.defaultBoardView"
            optionLabel="label"
            optionValue="value"
            placeholder="Select default view"
            class="w-full"
          />
        </div>

        <!-- Sidebar Density -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium" style="color: var(--foreground)">
            Sidebar Density
          </label>
          <div class="flex gap-4 mt-1">
            <div class="flex items-center gap-2">
              <p-radioButton
                name="sidebarDensity"
                value="compact"
                [(ngModel)]="preferences.sidebarDensity"
              />
              <label class="text-sm" style="color: var(--foreground)"
                >Compact</label
              >
            </div>
            <div class="flex items-center gap-2">
              <p-radioButton
                name="sidebarDensity"
                value="comfortable"
                [(ngModel)]="preferences.sidebarDensity"
              />
              <label class="text-sm" style="color: var(--foreground)"
                >Comfortable</label
              >
            </div>
          </div>
        </div>

        <!-- Language -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium" style="color: var(--foreground)">
            Language
          </label>
          <p-select
            [options]="[{ label: 'English', value: 'en' }]"
            [(ngModel)]="preferences.language"
            optionLabel="label"
            optionValue="value"
            [disabled]="true"
            pTooltip="More languages coming soon"
            tooltipPosition="top"
            class="w-full"
          />
        </div>
      </div>

      <!-- Save Button -->
      <div
        class="flex justify-end mt-6 pt-4"
        style="border-top: 1px solid var(--border)"
      >
        <p-button
          label="Save Preferences"
          icon="pi pi-check"
          [loading]="isSaving()"
          [disabled]="isSaving()"
          (onClick)="savePreferences()"
        />
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
export class AppearanceSectionComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly userPreferencesService = inject(UserPreferencesService);
  private readonly messageService = inject(MessageService);

  currentTheme = this.themeService.theme;
  currentAccent = this.themeService.accent;
  isDark = this.themeService.isDark;
  accentPresets = ACCENT_PRESETS;

  isSaving = signal(false);

  themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'pi pi-sun' },
    { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
    { value: 'system', label: 'System', icon: 'pi pi-desktop' },
  ];

  timezoneOptions: TimezoneOption[] = [
    { label: 'UTC', value: 'UTC' },
    { label: 'Eastern (New York)', value: 'America/New_York' },
    { label: 'Central (Chicago)', value: 'America/Chicago' },
    { label: 'Mountain (Denver)', value: 'America/Denver' },
    { label: 'Pacific (Los Angeles)', value: 'America/Los_Angeles' },
    { label: 'London', value: 'Europe/London' },
    { label: 'Paris', value: 'Europe/Paris' },
    { label: 'Berlin', value: 'Europe/Berlin' },
    { label: 'Tokyo', value: 'Asia/Tokyo' },
    { label: 'Shanghai', value: 'Asia/Shanghai' },
    { label: 'Kolkata', value: 'Asia/Kolkata' },
    { label: 'Sydney', value: 'Australia/Sydney' },
  ];

  dateFormatOptions: DateFormatOption[] = [
    { label: 'Jan 15, 2026', value: 'MMM dd, yyyy' },
    { label: '15/01/2026', value: 'dd/MM/yyyy' },
    { label: '2026-01-15', value: 'yyyy-MM-dd' },
    { label: '01/15/2026', value: 'MM/dd/yyyy' },
  ];

  boardViewOptions: BoardViewOption[] = [
    { label: 'Kanban', value: 'kanban' },
    { label: 'List View', value: 'list' },
  ];

  preferences = {
    timezone: 'UTC',
    dateFormat: 'MMM dd, yyyy',
    defaultBoardView: 'list',
    sidebarDensity: 'comfortable',
    language: 'en',
  };

  ngOnInit(): void {
    this.loadPreferences();
  }

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  setAccent(accent: AccentColor): void {
    this.themeService.setAccent(accent);
  }

  savePreferences(): void {
    this.isSaving.set(true);
    this.userPreferencesService
      .updatePreferences({
        timezone: this.preferences.timezone,
        date_format: this.preferences.dateFormat,
        default_project_view: this.preferences.defaultBoardView,
        sidebar_density: this.preferences.sidebarDensity,
        language: this.preferences.language,
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Preferences updated successfully',
          });
          this.isSaving.set(false);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to save preferences',
          });
          this.isSaving.set(false);
        },
      });
  }

  private loadPreferences(): void {
    this.userPreferencesService.getPreferences().subscribe({
      next: (prefs) => {
        if (prefs) {
          this.preferences = {
            timezone: prefs.timezone || 'UTC',
            dateFormat: prefs.date_format || 'MMM dd, yyyy',
            defaultBoardView: prefs.default_project_view || 'list',
            sidebarDensity: prefs.sidebar_density || 'comfortable',
            language: prefs.language || 'en',
          };
        }
      },
      error: () => {
        // Keep defaults on error
      },
    });
  }
}

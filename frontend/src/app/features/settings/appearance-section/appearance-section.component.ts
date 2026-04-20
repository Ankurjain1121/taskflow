import {
  Component,
  OnInit,
  OnDestroy,
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
} from '../../../core/services/theme.service';
import { UserPreferencesService } from '../../../core/services/user-preferences.service';
import { THEME_PALETTES, DARK_THEME_PALETTES } from '../../../core/constants/color-palettes';
import { LightTheme, DarkTheme } from '../../../shared/types/theme.types';

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
      <h2 class="text-xl font-semibold mb-1 font-display" style="color: var(--foreground)">
        Theme
      </h2>
      <p class="text-sm mb-4" style="color: var(--muted-foreground)">
        Choose your preferred theme
      </p>

      <!-- Color Mode -->
      <div class="flex gap-3">
        @for (option of themeOptions; track option.value) {
          <button
            (click)="setTheme(option.value)"
            class="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer flex-1 focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
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
    </div>

    <!-- Light Theme Picker -->
    <div
      class="rounded-lg border shadow-sm p-6 mb-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <h2 class="text-xl font-semibold mb-1 font-display" style="color: var(--foreground)">
        Light Theme
      </h2>
      <p class="text-sm mb-4" style="color: var(--muted-foreground)">
        Choose your preferred light theme
      </p>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" role="radiogroup" aria-label="Light theme selection">
        @for (theme of lightThemes; track theme.id) {
          <button
            class="flex flex-col items-center gap-2 cursor-pointer group focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 rounded-lg"
            role="radio"
            [attr.aria-checked]="currentLightTheme() === theme.id"
            [attr.aria-label]="theme.name"
            (click)="selectLightTheme(theme.id)"
            (mouseenter)="previewLightTheme(theme.id)"
            (mouseleave)="revertPreview()"
          >
            <div
              class="relative w-full h-20 rounded-lg overflow-hidden border-2 transition-all flex flex-col"
              [style.border-color]="currentLightTheme() === theme.id ? 'var(--primary)' : 'var(--border)'"
              [class.shadow-md]="currentLightTheme() === theme.id"
            >
              @for (color of theme.palette6; track $index) {
                <div style="flex: 1" [style.background]="color"></div>
              }
              @if (currentLightTheme() === theme.id) {
                <div
                  class="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  [style.background]="theme.preview.primary"
                >
                  <i class="pi pi-check text-white" style="font-size: 10px"></i>
                </div>
              }
            </div>
            <span
              class="text-xs font-medium"
              [style.color]="currentLightTheme() === theme.id ? 'var(--foreground)' : 'var(--muted-foreground)'"
            >
              {{ theme.name }}
            </span>
          </button>
        }
      </div>
    </div>

    <!-- Dark Theme Picker -->
    <div
      class="rounded-lg border shadow-sm p-6 mb-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <h2 class="text-xl font-semibold mb-1 font-display" style="color: var(--foreground)">
        Dark Theme
      </h2>
      <p class="text-sm mb-4" style="color: var(--muted-foreground)">
        Choose your preferred dark theme
      </p>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" role="radiogroup" aria-label="Dark theme selection">
        @for (theme of darkThemes; track theme.id) {
          <button
            class="flex flex-col items-center gap-2 cursor-pointer group focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 rounded-lg"
            role="radio"
            [attr.aria-checked]="currentDarkTheme() === theme.id"
            [attr.aria-label]="theme.name"
            (click)="selectDarkTheme(theme.id)"
            (mouseenter)="previewDarkTheme(theme.id)"
            (mouseleave)="revertPreview()"
          >
            <div
              class="relative w-full h-20 rounded-lg overflow-hidden border-2 transition-all flex flex-col"
              [style.border-color]="currentDarkTheme() === theme.id ? 'var(--primary)' : 'var(--border)'"
              [class.shadow-md]="currentDarkTheme() === theme.id"
            >
              @for (color of theme.palette6; track $index) {
                <div style="flex: 1" [style.background]="color"></div>
              }
              @if (currentDarkTheme() === theme.id) {
                <div
                  class="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  [style.background]="theme.preview.primary"
                >
                  <i class="pi pi-check text-white" style="font-size: 10px"></i>
                </div>
              }
            </div>
            <span
              class="text-xs font-medium"
              [style.color]="currentDarkTheme() === theme.id ? 'var(--foreground)' : 'var(--muted-foreground)'"
            >
              {{ theme.name }}
            </span>
          </button>
        }
      </div>
    </div>

    <!-- Preferences Section -->
    <div
      class="rounded-lg border shadow-sm p-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <h2 class="text-xl font-semibold mb-1 font-display" style="color: var(--foreground)">
        Preferences
      </h2>
      <p class="text-sm mb-5" style="color: var(--muted-foreground)">
        Customize your workspace experience
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Timezone -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--muted-foreground)">
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
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--muted-foreground)">
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
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--muted-foreground)">
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
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--muted-foreground)">
            Sidebar Density
          </label>
          <div class="flex gap-4 mt-1">
            <div class="flex items-center gap-2">
              <p-radioButton
                name="sidebarDensity"
                value="compact"
                [(ngModel)]="preferences.sidebarDensity"
              />
              <label class="text-xs uppercase tracking-wider" style="color: var(--foreground)"
                >Compact</label
              >
            </div>
            <div class="flex items-center gap-2">
              <p-radioButton
                name="sidebarDensity"
                value="comfortable"
                [(ngModel)]="preferences.sidebarDensity"
              />
              <label class="text-xs uppercase tracking-wider" style="color: var(--foreground)"
                >Comfortable</label
              >
            </div>
          </div>
        </div>

        <!-- Language -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold uppercase tracking-wider" style="color: var(--muted-foreground)">
            Language
          </label>
          <p-select
            [options]="[{ label: 'English', value: 'en' }]"
            [(ngModel)]="preferences.locale"
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
export class AppearanceSectionComponent implements OnInit, OnDestroy {
  private readonly themeService = inject(ThemeService);
  private readonly userPreferencesService = inject(UserPreferencesService);
  private readonly messageService = inject(MessageService);

  currentTheme = this.themeService.theme;
  isDark = this.themeService.isDark;

  isSaving = signal(false);

  // Theme picker data
  lightThemes = Object.entries(THEME_PALETTES).map(([id, palette]) => ({
    id: id as LightTheme,
    name: palette.name,
    preview: palette.preview,
    palette6: palette.palette6,
  }));

  darkThemes = Object.entries(DARK_THEME_PALETTES).map(([id, palette]) => ({
    id: id as DarkTheme,
    name: palette.name,
    preview: palette.preview,
    palette6: palette.palette6,
  }));

  currentLightTheme = this.themeService.lightTheme;
  currentDarkTheme = this.themeService.darkTheme;

  private previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
    locale: 'en',
  };

  ngOnInit(): void {
    this.loadPreferences();
  }

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  selectLightTheme(id: LightTheme): void {
    this.clearPreviewDebounce();
    this.themeService.setLightTheme(id);
  }

  selectDarkTheme(id: DarkTheme): void {
    this.clearPreviewDebounce();
    this.themeService.setDarkTheme(id);
  }

  previewLightTheme(id: LightTheme): void {
    this.clearPreviewDebounce();
    this.previewDebounceTimer = setTimeout(() => {
      this.themeService.previewTheme(id);
    }, 150);
  }

  previewDarkTheme(id: DarkTheme): void {
    this.clearPreviewDebounce();
    this.previewDebounceTimer = setTimeout(() => {
      this.themeService.previewDarkTheme(id);
    }, 150);
  }

  revertPreview(): void {
    this.clearPreviewDebounce();
    this.themeService.revertPreview();
  }

  ngOnDestroy(): void {
    this.clearPreviewDebounce();
    this.themeService.revertPreview();
  }

  savePreferences(): void {
    this.isSaving.set(true);
    this.userPreferencesService
      .updatePreferences({
        timezone: this.preferences.timezone,
        date_format: this.preferences.dateFormat,
        default_project_view: this.preferences.defaultBoardView,
        sidebar_density: this.preferences.sidebarDensity,
        locale: this.preferences.locale,
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

  private clearPreviewDebounce(): void {
    if (this.previewDebounceTimer) {
      clearTimeout(this.previewDebounceTimer);
      this.previewDebounceTimer = null;
    }
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
            locale: prefs.locale || 'en',
          };
        }
      },
      error: () => {
        // Keep defaults on error
      },
    });
  }
}

import {
  Component,
  input,
  output,
  signal,
  inject,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Menu } from 'primeng/menu';
import {
  FilterPresetsService,
  FilterPreset,
} from '../../../core/services/filter-presets.service';
import { TaskFilters } from './board-toolbar.component';

@Component({
  selector: 'app-save-preset-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, Dialog, Menu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Preset Buttons -->
    <div class="flex items-center gap-1">
      @if (presets().length > 0) {
        <p-button
          icon="pi pi-bookmark"
          severity="secondary"
          [text]="true"
          size="small"
          (onClick)="presetsMenu.toggle($event)"
          pTooltip="Load saved filter"
        />
        <p-menu #presetsMenu [popup]="true" [model]="presetMenuItems()" />
      }
      @if (activeFilterCount() > 0) {
        <p-button
          icon="pi pi-save"
          severity="secondary"
          [text]="true"
          size="small"
          (onClick)="showDialog = true"
          pTooltip="Save current filters"
        />
      }
    </div>

    <!-- Save Dialog -->
    <p-dialog
      header="Save Filter Preset"
      [(visible)]="showDialog"
      [modal]="true"
      [style]="{ width: '400px' }"
    >
      <div class="flex flex-col gap-3">
        <label class="text-sm font-medium text-[var(--foreground)]">
          Preset name
        </label>
        <input
          pInputText
          [(ngModel)]="newPresetName"
          placeholder="e.g. My urgent tasks"
          class="w-full"
          (keydown.enter)="savePreset()"
        />
      </div>
      <ng-template #footer>
        <p-button
          label="Cancel"
          severity="secondary"
          [text]="true"
          (onClick)="showDialog = false"
        />
        <p-button
          label="Save"
          icon="pi pi-check"
          (onClick)="savePreset()"
          [disabled]="!newPresetName.trim()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class SavePresetDialogComponent implements OnDestroy {
  private filterPresetsService = inject(FilterPresetsService);
  private destroy$ = new Subject<void>();

  boardId = input.required<string>();
  filters = input.required<TaskFilters>();
  activeFilterCount = input.required<number>();
  presets = input.required<FilterPreset[]>();

  presetLoaded = output<FilterPreset>();
  presetsReloaded = output<void>();

  showDialog = false;
  newPresetName = '';

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  presetMenuItems(): { label: string; icon: string; command: () => void }[] {
    return this.presets().map((p) => ({
      label: p.name,
      icon: 'pi pi-bookmark',
      command: () => this.presetLoaded.emit(p),
    }));
  }

  savePreset(): void {
    const name = this.newPresetName.trim();
    const id = this.boardId();
    if (!name || !id) return;

    this.filterPresetsService
      .create(id, {
        name,
        filters: this.filters() as unknown as Record<string, unknown>,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showDialog = false;
          this.newPresetName = '';
          this.presetsReloaded.emit();
        },
        error: () => {
          // Subscription completes on error; dialog stays open for retry
        },
      });
  }
}

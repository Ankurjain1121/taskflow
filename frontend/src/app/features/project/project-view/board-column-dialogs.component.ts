import {
  Component,
  inject,
  signal,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntil, Subject } from 'rxjs';
import { ProjectService, Column } from '../../../core/services/project.service';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { Dialog } from 'primeng/dialog';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { ImportDialogComponent } from '../import-export/import-dialog.component';
import { ExportDialogComponent } from '../import-export/export-dialog.component';
import { ProjectStateService } from './board-state.service';

@Component({
  selector: 'app-project-column-dialogs',
  standalone: true,
  imports: [
    FormsModule,
    Menu,
    Dialog,
    ConfirmDialog,
    InputTextModule,
    InputNumber,
    ButtonModule,
    Checkbox,
    ImportDialogComponent,
    ExportDialogComponent,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Column Rename Dialog -->
    <p-dialog
      header="Rename Column"
      [(visible)]="showRenameDialog"
      [modal]="true"
      [style]="{ width: '400px' }"
    >
      <div class="flex flex-col gap-3">
        <label class="text-sm font-medium text-[var(--foreground)]"
          >Column name</label
        >
        <input
          pInputText
          [(ngModel)]="renameDialogValue"
          placeholder="Column name"
          class="w-full"
          (keydown.enter)="confirmRename()"
        />
      </div>
      <ng-template #footer>
        <p-button
          label="Cancel"
          severity="secondary"
          [text]="true"
          (onClick)="showRenameDialog = false"
        />
        <p-button
          label="Rename"
          icon="pi pi-check"
          (onClick)="confirmRename()"
          [disabled]="!renameDialogValue.trim()"
        />
      </ng-template>
    </p-dialog>

    <!-- WIP Limit Dialog -->
    <p-dialog
      header="Set WIP Limit"
      [(visible)]="showWipLimitDialog"
      [modal]="true"
      [style]="{ width: '400px' }"
    >
      <div class="flex flex-col gap-3">
        <label class="text-sm font-medium text-[var(--foreground)]">
          Maximum tasks in this column (0 = no limit)
        </label>
        <p-inputNumber
          [(ngModel)]="wipLimitDialogValue"
          [min]="0"
          [max]="999"
          [showButtons]="true"
          placeholder="No limit"
          inputStyleClass="w-full"
        />
      </div>
      <ng-template #footer>
        <p-button
          label="Cancel"
          severity="secondary"
          [text]="true"
          (onClick)="showWipLimitDialog = false"
        />
        <p-button
          label="Save"
          icon="pi pi-check"
          (onClick)="confirmWipLimit()"
        />
      </ng-template>
    </p-dialog>

    <!-- Column Icon Picker Dialog -->
    <p-dialog
      header="Choose Column Icon"
      [(visible)]="showIconPicker"
      [modal]="true"
      [style]="{ width: '320px' }"
    >
      <div class="flex flex-col gap-3">
        <p class="text-sm text-[var(--muted-foreground)]">
          Select an emoji for this column, or clear to remove it.
        </p>
        <div class="grid grid-cols-6 gap-2">
          @for (emoji of columnIconOptions; track emoji) {
            <button
              (click)="selectColumnIcon(emoji)"
              class="text-2xl p-2 rounded hover:bg-[var(--muted)] transition-colors text-center"
              [class.ring-2]="iconPickerCurrentIcon === emoji"
              [title]="emoji"
            >
              {{ emoji }}
            </button>
          }
        </div>
        <div class="border-t border-[var(--border)] pt-2">
          <button
            (click)="selectColumnIcon(null)"
            class="w-full px-3 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded transition-colors"
          >
            Clear icon
          </button>
        </div>
      </div>
    </p-dialog>

    <!-- Import/Export Dialogs -->
    <app-import-dialog
      [(visible)]="showImportDialog"
      [boardId]="boardId"
      [boardName]="boardName"
    />
    <app-export-dialog
      [(visible)]="showExportDialog"
      [boardId]="boardId"
      [boardName]="boardName"
    />

    <!-- Duplicate Project Dialog -->
    <p-dialog
      header="Duplicate Project"
      [(visible)]="showDuplicateDialog"
      [modal]="true"
      [style]="{ width: '420px' }"
    >
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-sm font-medium text-[var(--foreground)] mb-1"
            >Project Name</label
          >
          <input
            pInputText
            [(ngModel)]="duplicateBoardName"
            class="w-full"
            placeholder="Enter project name"
          />
        </div>
        <label class="flex items-center gap-2">
          <p-checkbox [(ngModel)]="duplicateIncludeTasks" [binary]="true" />
          <span class="text-sm text-[var(--foreground)]">Include tasks</span>
        </label>
      </div>
      <ng-template #footer>
        <p-button
          label="Cancel"
          severity="secondary"
          [text]="true"
          (onClick)="showDuplicateDialog = false"
        />
        <p-button
          label="Duplicate"
          icon="pi pi-copy"
          (onClick)="onDuplicateBoard()"
          [loading]="duplicating()"
          [disabled]="!duplicateBoardName.trim()"
        />
      </ng-template>
    </p-dialog>

    <!-- Column Delete Confirmation -->
    <p-confirmDialog />

    <!-- More Menu (rendered here, toggled from parent) -->
    <p-menu #moreMenu [popup]="true" [model]="moreMenuItems" />
  `,
})
export class ProjectColumnDialogsComponent {
  private projectService = inject(ProjectService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);
  readonly state = inject(ProjectStateService);

  @Input() boardId = '';
  @Input() workspaceId = '';
  @Input() boardName = '';
  @Input() destroy$ = new Subject<void>();

  @Output() columnUpdated = new EventEmitter<Column>();
  @Output() boardDuplicated = new EventEmitter<{ id: string }>();

  // Column rename
  showRenameDialog = false;
  renameDialogColumnId = '';
  renameDialogValue = '';

  // WIP limit
  showWipLimitDialog = false;
  wipLimitDialogColumnId = '';
  wipLimitDialogValue: number | null = null;

  // Icon picker
  showIconPicker = false;
  iconPickerColumnId = '';
  iconPickerCurrentIcon: string | null = null;
  readonly columnIconOptions = [
    '📋',
    '✅',
    '🚀',
    '🐛',
    '📌',
    '🎯',
    '💡',
    '🔥',
    '⚡',
    '🏗️',
    '🧪',
    '📦',
  ];

  // Import/Export
  showImportDialog = false;
  showExportDialog = false;

  // Duplicate board
  showDuplicateDialog = false;
  duplicateBoardName = '';
  duplicateIncludeTasks = false;
  duplicating = signal(false);

  // More menu
  moreMenuItems: MenuItem[] = [];

  buildMoreMenuItems(): void {
    this.moreMenuItems = [
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        command: () =>
          this.router.navigate([
            '/workspace',
            this.workspaceId,
            'project',
            this.boardId,
            'settings',
          ]),
      },
      {
        label: 'Import',
        icon: 'pi pi-upload',
        command: () => (this.showImportDialog = true),
      },
      {
        label: 'Export',
        icon: 'pi pi-download',
        command: () => (this.showExportDialog = true),
      },
      {
        label: 'Share',
        icon: 'pi pi-share-alt',
        command: () =>
          this.router.navigate(
            ['/workspace', this.workspaceId, 'project', this.boardId, 'settings'],
            { queryParams: { tab: 6 } },
          ),
      },
      { separator: true },
      {
        label: 'Duplicate Board',
        icon: 'pi pi-copy',
        command: () => {
          this.duplicateBoardName = `Copy of ${this.boardName || 'Project'}`;
          this.duplicateIncludeTasks = false;
          this.showDuplicateDialog = true;
        },
      },
    ];
  }

  // === Column Operations ===

  openRenameDialog(columnId: string): void {
    const column = this.state.columns().find((c) => c.id === columnId);
    if (!column) return;
    this.renameDialogColumnId = columnId;
    this.renameDialogValue = column.name;
    this.showRenameDialog = true;
  }

  confirmRename(): void {
    const name = this.renameDialogValue.trim();
    if (!name) return;

    this.projectService
      .updateColumn(this.renameDialogColumnId, { name })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedColumn) => {
          this.columnUpdated.emit(updatedColumn);
        },
        error: () => this.state.showError('Failed to rename column'),
      });

    this.showRenameDialog = false;
  }

  openWipLimitDialog(columnId: string): void {
    const column = this.state.columns().find((c) => c.id === columnId);
    if (!column) return;
    this.wipLimitDialogColumnId = columnId;
    this.wipLimitDialogValue = column.wip_limit;
    this.showWipLimitDialog = true;
  }

  confirmWipLimit(): void {
    const wipLimit =
      this.wipLimitDialogValue && this.wipLimitDialogValue > 0
        ? this.wipLimitDialogValue
        : null;

    this.projectService
      .updateColumnWipLimit(this.wipLimitDialogColumnId, wipLimit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedColumn) => {
          this.columnUpdated.emit(updatedColumn);
        },
        error: () => this.state.showError('Failed to update WIP limit'),
      });

    this.showWipLimitDialog = false;
  }

  openIconPicker(event: {
    columnId: string;
    currentIcon: string | null;
  }): void {
    this.iconPickerColumnId = event.columnId;
    this.iconPickerCurrentIcon = event.currentIcon;
    this.showIconPicker = true;
  }

  selectColumnIcon(icon: string | null): void {
    this.projectService
      .updateColumnIcon(this.iconPickerColumnId, icon)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedColumn) => {
          this.columnUpdated.emit(updatedColumn);
          this.showIconPicker = false;
        },
        error: () => this.state.showError('Failed to update column icon'),
      });
  }

  confirmDeleteColumn(columnId: string): void {
    const column = this.state.columns().find((c) => c.id === columnId);
    if (!column) return;

    this.confirmationService.confirm({
      message: `Delete column "${column.name}"? Tasks in this column must be moved first.`,
      header: 'Delete Column',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.state.deleteColumn(this.boardId, columnId);
      },
    });
  }

  onDuplicateBoard(): void {
    const name = this.duplicateBoardName.trim();
    if (!name) return;

    this.duplicating.set(true);
    this.projectService
      .duplicateBoard(this.boardId, {
        name,
        include_tasks: this.duplicateIncludeTasks,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newBoard) => {
          this.duplicating.set(false);
          this.showDuplicateDialog = false;
          this.boardDuplicated.emit(newBoard);
        },
        error: () => {
          this.duplicating.set(false);
          this.state.showError('Failed to duplicate board');
        },
      });
  }
}

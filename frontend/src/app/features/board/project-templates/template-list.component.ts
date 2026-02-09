import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  ProjectTemplateService,
  ProjectTemplate,
} from '../../../core/services/project-template.service';
import {
  WorkspaceService,
  Workspace,
} from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Inline dialog component for creating a board from a template.
 * Asks the user for a board name and workspace selection.
 */
@Component({
  selector: 'app-use-template-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Create Board from Template</h2>
    <mat-dialog-content class="flex flex-col gap-4 min-w-[400px]">
      <p class="text-gray-600">
        Create a new board using the "{{ data.templateName }}" template.
      </p>
      <mat-form-field appearance="outline">
        <mat-label>Board Name</mat-label>
        <input matInput [(ngModel)]="boardName" placeholder="My New Board" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Workspace</mat-label>
        <mat-select [(ngModel)]="selectedWorkspaceId">
          @for (ws of data.workspaces; track ws.id) {
            <mat-option [value]="ws.id">{{ ws.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!boardName.trim() || !selectedWorkspaceId"
        (click)="onConfirm()"
      >
        Create Board
      </button>
    </mat-dialog-actions>
  `,
})
export class UseTemplateDialogComponent {
  data = inject<UseTemplateDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef);

  boardName = '';
  selectedWorkspaceId = '';

  constructor() {
    if (this.data.workspaces.length > 0) {
      this.selectedWorkspaceId = this.data.workspaces[0].id;
    }
  }

  onConfirm(): void {
    if (!this.boardName.trim() || !this.selectedWorkspaceId) return;
    this.dialogRef.close({
      boardName: this.boardName.trim(),
      workspaceId: this.selectedWorkspaceId,
    });
  }
}

export interface UseTemplateDialogData {
  templateName: string;
  workspaces: Workspace[];
}

export interface UseTemplateDialogResult {
  boardName: string;
  workspaceId: string;
}

/**
 * Template list component showing all available project templates.
 * Supports category filtering, creating boards from templates, and deleting owned templates.
 */
@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Project Templates</h2>
          <p class="mt-1 text-gray-500">
            Choose a template to quickly set up a new board with predefined
            columns and tasks.
          </p>
        </div>
      </div>

      <!-- Category Filters -->
      @if (categories().length > 0) {
        <div class="mb-6 flex flex-wrap gap-2">
          <button
            mat-stroked-button
            [class.!bg-indigo-100]="!selectedCategory()"
            [class.!text-indigo-700]="!selectedCategory()"
            (click)="selectedCategory.set(null)"
          >
            All
          </button>
          @for (cat of categories(); track cat) {
            <button
              mat-stroked-button
              [class.!bg-indigo-100]="selectedCategory() === cat"
              [class.!text-indigo-700]="selectedCategory() === cat"
              (click)="selectedCategory.set(cat)"
            >
              {{ cat }}
            </button>
          }
        </div>
      }

      <!-- Loading State -->
      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (filteredTemplates().length === 0) {
        <!-- Empty State -->
        <div class="text-center py-16">
          <mat-icon class="!text-6xl !h-16 !w-16 text-gray-300 mx-auto mb-4"
            >dashboard_customize</mat-icon
          >
          <h3 class="text-lg font-medium text-gray-900 mb-1">
            No templates found
          </h3>
          <p class="text-gray-500">
            @if (selectedCategory()) {
              No templates match the selected category. Try clearing the filter.
            } @else {
              No templates are available yet. Save a board as a template to get
              started.
            }
          </p>
        </div>
      } @else {
        <!-- Template Grid -->
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          @for (template of filteredTemplates(); track template.id) {
            <mat-card class="hover:shadow-lg transition-shadow duration-200">
              <mat-card-header>
                <mat-card-title class="!text-base !font-semibold">
                  {{ template.name }}
                </mat-card-title>
                @if (template.category) {
                  <mat-card-subtitle>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700"
                    >
                      {{ template.category }}
                    </span>
                    @if (template.is_public) {
                      <span
                        class="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"
                      >
                        Public
                      </span>
                    }
                  </mat-card-subtitle>
                }
              </mat-card-header>
              <mat-card-content>
                <p class="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
                  {{ template.description || 'No description' }}
                </p>
              </mat-card-content>
              <mat-card-actions align="end">
                @if (isOwner(template)) {
                  <button
                    mat-icon-button
                    matTooltip="Delete template"
                    (click)="onDeleteTemplate(template); $event.stopPropagation()"
                  >
                    <mat-icon class="text-red-500">delete</mat-icon>
                  </button>
                }
                <button
                  mat-flat-button
                  color="primary"
                  (click)="onUseTemplate(template)"
                >
                  Use Template
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }

      <!-- Error State -->
      @if (error()) {
        <div
          class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
        >
          {{ error() }}
        </div>
      }
    </div>
  `,
})
export class TemplateListComponent implements OnInit {
  private templateService = inject(ProjectTemplateService);
  private workspaceService = inject(WorkspaceService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  templates = signal<ProjectTemplate[]>([]);
  workspaces = signal<Workspace[]>([]);
  selectedCategory = signal<string | null>(null);

  categories = computed(() => {
    const cats = new Set<string>();
    for (const t of this.templates()) {
      if (t.category) {
        cats.add(t.category);
      }
    }
    return Array.from(cats).sort();
  });

  filteredTemplates = computed(() => {
    const cat = this.selectedCategory();
    if (!cat) return this.templates();
    return this.templates().filter((t) => t.category === cat);
  });

  ngOnInit(): void {
    this.loadTemplates();
    this.loadWorkspaces();
  }

  isOwner(template: ProjectTemplate): boolean {
    const user = this.authService.currentUser();
    return !!user && template.created_by_id === user.id;
  }

  onUseTemplate(template: ProjectTemplate): void {
    const dialogRef = this.dialog.open(UseTemplateDialogComponent, {
      data: {
        templateName: template.name,
        workspaces: this.workspaces(),
      } as UseTemplateDialogData,
    });

    dialogRef
      .afterClosed()
      .subscribe((result: UseTemplateDialogResult | undefined) => {
        if (!result) return;

        this.loading.set(true);
        this.templateService
          .createBoardFromTemplate(template.id, {
            workspace_id: result.workspaceId,
            board_name: result.boardName,
          })
          .subscribe({
            next: (res) => {
              this.loading.set(false);
              this.router.navigate([
                '/workspace',
                result.workspaceId,
                'board',
                res.board_id,
              ]);
            },
            error: (err) => {
              console.error('Failed to create board from template:', err);
              this.error.set('Failed to create board from template.');
              this.loading.set(false);
            },
          });
      });
  }

  onDeleteTemplate(template: ProjectTemplate): void {
    const confirmed = confirm(
      `Are you sure you want to delete the "${template.name}" template? This action cannot be undone.`
    );
    if (!confirmed) return;

    this.templateService.deleteTemplate(template.id).subscribe({
      next: () => {
        this.templates.update((list) =>
          list.filter((t) => t.id !== template.id)
        );
      },
      error: (err) => {
        console.error('Failed to delete template:', err);
        this.error.set('Failed to delete template.');
      },
    });
  }

  private loadTemplates(): void {
    this.loading.set(true);
    this.error.set(null);

    this.templateService.listTemplates().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load templates:', err);
        this.error.set('Failed to load templates.');
        this.loading.set(false);
      },
    });
  }

  private loadWorkspaces(): void {
    this.workspaceService.list().subscribe({
      next: (workspaces) => {
        this.workspaces.set(workspaces);
      },
      error: (err) => {
        console.error('Failed to load workspaces:', err);
      },
    });
  }
}

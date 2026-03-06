import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { Chip } from 'primeng/chip';
import { InputText } from 'primeng/inputtext';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { Dialog } from 'primeng/dialog';

import {
  ProjectTemplateService,
  ProjectTemplate,
} from '../../../core/services/project-template.service';
import {
  WorkspaceService,
  Workspace,
} from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';

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
 * Supports category filtering, creating projects from templates, and deleting owned templates.
 */
@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    Card,
    Chip,
    InputText,
    ProgressSpinner,
    Select,
    Tooltip,
    Dialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-[var(--foreground)]">
            Project Templates
          </h2>
          <p class="mt-1 text-[var(--muted-foreground)]">
            Choose a template to quickly set up a new board with predefined
            columns and tasks.
          </p>
        </div>
      </div>

      <!-- Category Filters -->
      @if (categories().length > 0) {
        <div class="mb-6 flex flex-wrap gap-2">
          <button
            pButton
            [outlined]="true"
            [style.background]="
              !selectedCategory()
                ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                : ''
            "
            [style.color]="!selectedCategory() ? 'var(--color-primary)' : ''"
            (click)="selectedCategory.set(null)"
            label="All"
          ></button>
          @for (cat of categories(); track cat) {
            <button
              pButton
              [outlined]="true"
              [style.background]="
                selectedCategory() === cat
                  ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                  : ''
              "
              [style.color]="
                selectedCategory() === cat ? 'var(--color-primary)' : ''
              "
              (click)="selectedCategory.set(cat)"
              [label]="cat"
            ></button>
          }
        </div>
      }

      <!-- Loading State -->
      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <p-progressSpinner
            [style]="{ width: '40px', height: '40px' }"
            strokeWidth="4"
          />
        </div>
      } @else if (filteredTemplates().length === 0) {
        <!-- Empty State -->
        <div class="text-center py-16">
          <i
            class="pi pi-th-large text-6xl text-[var(--muted-foreground)] mb-4"
          ></i>
          <h3 class="text-lg font-medium text-[var(--foreground)] mb-1">
            No templates found
          </h3>
          <p class="text-[var(--muted-foreground)]">
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
            <p-card styleClass="hover:shadow-lg transition-shadow duration-200">
              <ng-template #header>
                <div class="p-4 pb-0">
                  <div class="text-base font-semibold">{{ template.name }}</div>
                  @if (template.category) {
                    <div class="mt-1">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary"
                      >
                        {{ template.category }}
                      </span>
                      @if (template.is_public) {
                        <span
                          class="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500"
                        >
                          Public
                        </span>
                      }
                    </div>
                  }
                </div>
              </ng-template>
              <p
                class="text-sm text-[var(--muted-foreground)] line-clamp-2 min-h-[2.5rem]"
              >
                {{ template.description || 'No description' }}
              </p>
              <ng-template #footer>
                <div class="flex justify-end gap-2">
                  @if (isOwner(template)) {
                    <button
                      pButton
                      [rounded]="true"
                      [text]="true"
                      pTooltip="Delete template"
                      (click)="
                        onDeleteTemplate(template); $event.stopPropagation()
                      "
                    >
                      <i class="pi pi-trash text-red-500"></i>
                    </button>
                  }
                  <button
                    pButton
                    label="Use Template"
                    (click)="onUseTemplate(template)"
                  ></button>
                </div>
              </ng-template>
            </p-card>
          }
        </div>
      }

      <!-- Error State -->
      @if (error()) {
        <div
          class="mt-4 p-4 bg-[var(--status-red-bg)] border border-[var(--status-red-border)] rounded-lg text-[var(--status-red-text)]"
        >
          {{ error() }}
        </div>
      }
    </div>

    <!-- Use Template Dialog (inline) -->
    <p-dialog
      header="Create Project from Template"
      [(visible)]="showUseTemplateDialog"
      [modal]="true"
      [style]="{ width: '450px' }"
      [closable]="true"
    >
      <div class="flex flex-col gap-4">
        <p class="text-[var(--muted-foreground)]">
          Create a new board using the "{{ dialogTemplateName() }}" template.
        </p>
        <div class="flex flex-col gap-2">
          <label for="dialogBoardName" class="text-sm font-medium"
            >Project Name</label
          >
          <input
            pInputText
            id="dialogBoardName"
            [(ngModel)]="dialogBoardName"
            placeholder="My New Project"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="dialogWorkspace" class="text-sm font-medium"
            >Workspace</label
          >
          <p-select
            id="dialogWorkspace"
            [(ngModel)]="dialogSelectedWorkspaceId"
            [options]="workspaceOptions()"
            optionLabel="name"
            optionValue="id"
            placeholder="Select a workspace"
            class="w-full"
          />
        </div>
      </div>
      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <button
            pButton
            [text]="true"
            label="Cancel"
            (click)="showUseTemplateDialog = false"
          ></button>
          <button
            pButton
            label="Create Project"
            [disabled]="!dialogBoardName.trim() || !dialogSelectedWorkspaceId"
            (click)="onDialogConfirm()"
          ></button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class TemplateListComponent implements OnInit {
  private templateService = inject(ProjectTemplateService);
  private workspaceService = inject(WorkspaceService);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  templates = signal<ProjectTemplate[]>([]);
  workspaces = signal<Workspace[]>([]);
  selectedCategory = signal<string | null>(null);

  // Dialog state
  showUseTemplateDialog = false;
  dialogBoardName = '';
  dialogSelectedWorkspaceId = '';
  dialogTemplateName = signal('');
  private dialogTemplateId = '';

  workspaceOptions = computed(() =>
    this.workspaces().map((ws) => ({ id: ws.id, name: ws.name })),
  );

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
    this.dialogTemplateId = template.id;
    this.dialogTemplateName.set(template.name);
    this.dialogBoardName = '';
    this.dialogSelectedWorkspaceId =
      this.workspaces().length > 0 ? this.workspaces()[0].id : '';
    this.showUseTemplateDialog = true;
  }

  onDialogConfirm(): void {
    if (!this.dialogBoardName.trim() || !this.dialogSelectedWorkspaceId) return;

    this.showUseTemplateDialog = false;
    this.loading.set(true);

    this.templateService
      .createBoardFromTemplate(this.dialogTemplateId, {
        workspace_id: this.dialogSelectedWorkspaceId,
        project_name: this.dialogBoardName.trim(),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.router.navigate([
            '/workspace',
            this.dialogSelectedWorkspaceId,
            'project',
            res.project_id,
          ]);
        },
        error: () => {
          this.error.set('Failed to create board from template.');
          this.loading.set(false);
        },
      });
  }

  onDeleteTemplate(template: ProjectTemplate): void {
    const confirmed = confirm(
      `Are you sure you want to delete the "${template.name}" template? This action cannot be undone.`,
    );
    if (!confirmed) return;

    this.templateService.deleteTemplate(template.id).subscribe({
      next: () => {
        this.templates.update((list) =>
          list.filter((t) => t.id !== template.id),
        );
      },
      error: () => {
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
      error: () => {
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
      error: () => {
        this.error.set('Failed to load workspaces.');
      },
    });
  }
}

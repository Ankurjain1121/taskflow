import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import {
  AutomationService,
  AutomationTemplate,
  TemplateCategory,
} from '../../../core/services/automation.service';
import { ProjectService, Board } from '../../../core/services/project.service';

interface TemplateGroup {
  category: TemplateCategory;
  label: string;
  icon: string;
  templates: AutomationTemplate[];
}

@Component({
  selector: 'app-automation-templates',
  standalone: true,
  imports: [CommonModule, FormsModule, ToggleSwitch, Dialog, Select, Toast],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <h3 class="text-lg font-semibold font-display text-[var(--card-foreground)]">
          Automation Templates
        </h3>
        <p class="text-sm text-[var(--muted-foreground)] mt-1">
          Pre-built automations you can enable and apply to any board.
        </p>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-12">
          <svg
            class="animate-spin h-6 w-6 text-primary"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      } @else if (groups().length === 0) {
        <div class="bg-[var(--secondary)] rounded-lg p-6 text-center">
          <svg
            class="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <p class="text-sm text-[var(--muted-foreground)]">
            No automation templates available.
          </p>
        </div>
      } @else {
        @for (group of groups(); track group.category) {
          <section>
            <div class="flex items-center gap-2 mb-3">
              <span class="text-base" [innerHTML]="group.icon"></span>
              <h4
                class="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider"
              >
                {{ group.label }}
              </h4>
              <span
                class="text-xs text-[var(--muted-foreground)] bg-[var(--secondary)] px-1.5 py-0.5 rounded-full"
              >
                {{ group.templates.length }}
              </span>
            </div>
            <div class="space-y-2">
              @for (tmpl of group.templates; track tmpl.id) {
                <div
                  class="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow"
                >
                  <div class="min-w-0 flex-1">
                    <div
                      class="text-sm font-semibold text-[var(--card-foreground)]"
                    >
                      {{ tmpl.name }}
                    </div>
                    <div
                      class="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2"
                    >
                      {{ tmpl.description }}
                    </div>
                  </div>
                  <div class="flex items-center gap-3 flex-shrink-0">
                    <p-toggleswitch
                      [ngModel]="tmpl.enabled"
                      (ngModelChange)="onToggle(tmpl, $event)"
                    />
                    <button
                      (click)="openApplyDialog(tmpl)"
                      class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors"
                      title="Apply to a project"
                    >
                      <svg
                        class="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Apply
                    </button>
                  </div>
                </div>
              }
            </div>
          </section>
        }
      }
    </div>

    <!-- Apply Dialog -->
    <p-dialog
      header="Apply Template to Project"
      [modal]="true"
      [(visible)]="applyDialogVisible"
      [style]="{ width: '420px' }"
    >
      <div class="space-y-4">
        <p class="text-sm text-[var(--muted-foreground)]">
          Select a project to apply
          <strong>{{ selectedTemplate()?.name }}</strong> to.
        </p>
        <div>
          <label class="block text-sm font-medium text-[var(--foreground)] mb-1"
            >Project</label
          >
          <p-select
            [options]="boardOptions()"
            [(ngModel)]="selectedBoardId"
            optionLabel="name"
            optionValue="id"
            placeholder="Select a project"
            [style]="{ width: '100%' }"
          />
        </div>
      </div>
      <ng-template #footer>
        <div class="flex justify-end gap-2 pt-2">
          <button
            (click)="applyDialogVisible = false"
            class="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
          <button
            (click)="onApply()"
            [disabled]="!selectedBoardId || applying()"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:brightness-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (applying()) {
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Applying...
            } @else {
              Apply Template
            }
          </button>
        </div>
      </ng-template>
    </p-dialog>
    <p-toast />
  `,
})
export class AutomationTemplatesComponent implements OnInit {
  private automationService = inject(AutomationService);
  private projectService = inject(ProjectService);
  private messageService = inject(MessageService);

  workspaceId = input.required<string>();

  loading = signal(true);
  templates = signal<AutomationTemplate[]>([]);
  groups = signal<TemplateGroup[]>([]);
  boards = signal<Board[]>([]);
  boardOptions = signal<{ id: string; name: string }[]>([]);

  applyDialogVisible = false;
  selectedTemplate = signal<AutomationTemplate | null>(null);
  selectedBoardId: string | null = null;
  applying = signal(false);

  private readonly categoryConfig: Record<
    TemplateCategory,
    { label: string; icon: string; order: number }
  > = {
    workflow: {
      label: 'Workflow',
      icon: '<svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>',
      order: 0,
    },
    notifications: {
      label: 'Notifications',
      icon: '<svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>',
      order: 1,
    },
    deadlines: {
      label: 'Deadlines',
      icon: '<svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      order: 2,
    },
    labels: {
      label: 'Labels',
      icon: '<svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>',
      order: 3,
    },
    collaboration: {
      label: 'Collaboration',
      icon: '<svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
      order: 4,
    },
    integrations: {
      label: 'Integrations',
      icon: '<svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>',
      order: 5,
    },
    custom_fields: {
      label: 'Custom Fields',
      icon: '<svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>',
      order: 6,
    },
  };

  ngOnInit(): void {
    this.loadTemplates();
    this.loadBoards();
  }

  onToggle(template: AutomationTemplate, enabled: boolean): void {
    const snapshot = this.templates();

    // Optimistic update
    this.templates.update((ts) =>
      ts.map((t) => (t.id === template.id ? { ...t, enabled } : t)),
    );
    this.rebuildGroups();

    this.automationService
      .toggleTemplate(this.workspaceId(), template.id, enabled)
      .subscribe({
        error: () => {
          this.templates.set(snapshot);
          this.rebuildGroups();
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update template. Please try again.',
            life: 3000,
          });
        },
      });
  }

  openApplyDialog(template: AutomationTemplate): void {
    this.selectedTemplate.set(template);
    this.selectedBoardId = null;
    this.applyDialogVisible = true;
  }

  onApply(): void {
    const template = this.selectedTemplate();
    const boardId = this.selectedBoardId;
    if (!template || !boardId) return;

    this.applying.set(true);
    this.automationService
      .applyTemplate(this.workspaceId(), template.id, boardId)
      .subscribe({
        next: () => {
          this.applying.set(false);
          this.applyDialogVisible = false;
          const boardName =
            this.boards().find((b) => b.id === boardId)?.name ?? 'board';
          this.messageService.add({
            severity: 'success',
            summary: 'Template Applied',
            detail: `"${template.name}" has been applied to ${boardName}.`,
            life: 3000,
          });
        },
        error: () => {
          this.applying.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to apply template. Please try again.',
            life: 3000,
          });
        },
      });
  }

  private loadTemplates(): void {
    this.loading.set(true);
    this.automationService.listTemplates(this.workspaceId()).subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.rebuildGroups();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load automation templates.',
          life: 3000,
        });
      },
    });
  }

  private loadBoards(): void {
    this.projectService.listBoards(this.workspaceId()).subscribe({
      next: (boards) => {
        this.boards.set(boards);
        this.boardOptions.set(boards.map((b) => ({ id: b.id, name: b.name })));
      },
    });
  }

  private rebuildGroups(): void {
    const byCategory = new Map<TemplateCategory, AutomationTemplate[]>();
    for (const t of this.templates()) {
      const list = byCategory.get(t.category) ?? [];
      list.push(t);
      byCategory.set(t.category, list);
    }

    const result: TemplateGroup[] = [];
    for (const [category, templates] of byCategory) {
      const config = this.categoryConfig[category];
      if (config) {
        result.push({
          category,
          label: config.label,
          icon: config.icon,
          templates,
        });
      }
    }

    result.sort(
      (a, b) =>
        (this.categoryConfig[a.category]?.order ?? 99) -
        (this.categoryConfig[b.category]?.order ?? 99),
    );

    this.groups.set(result);
  }
}

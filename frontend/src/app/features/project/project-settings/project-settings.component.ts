import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import {
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Subscription, forkJoin } from 'rxjs';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  Project,
  ProjectColumn,
  ProjectMemberInfo,
} from '../../../shared/types/project.types';
import { MemberPickerComponent } from '../../../shared/components/member-picker/member-picker.component';
import { MemberSearchResult } from '../../../core/services/workspace.service';

@Component({
  selector: 'app-project-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    Textarea,
    CdkDropList,
    CdkDrag,
    MemberPickerComponent,
  ],
  template: `
    <div class="max-w-4xl mx-auto p-6 space-y-8">
      <!-- Back link -->
      <a
        [routerLink]="['..']"
        class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <i class="pi pi-arrow-left !text-[18px]"></i>
        Back to Project
      </a>

      @if (loading()) {
        <p class="text-gray-500">Loading project settings...</p>
      }

      @if (!loading() && project()) {
        <!-- Project info section -->
        <section
          class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4"
        >
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Project Details
          </h2>

          <div class="flex flex-col gap-1">
            <label
              for="projectName"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Project Name</label
            >
            <input
              pInputText
              id="projectName"
              [(ngModel)]="projectName"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label
              for="projectDesc"
              class="text-sm font-medium text-gray-700 dark:text-gray-300"
              >Description</label
            >
            <textarea
              pTextarea
              id="projectDesc"
              [(ngModel)]="projectDescription"
              rows="3"
              class="w-full"
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label
                for="projectColor"
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >Color</label
              >
              <input
                pInputText
                id="projectColor"
                [(ngModel)]="projectColor"
                placeholder="#6366f1"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label
                for="projectIcon"
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >Icon</label
              >
              <input
                pInputText
                id="projectIcon"
                [(ngModel)]="projectIcon"
                placeholder="folder"
              />
            </div>
          </div>

          <p-button label="Save Changes" (onClick)="saveProject()" />
        </section>

        <!-- Columns section -->
        <section
          class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Columns
            </h2>
            <p-button
              label="Add Column"
              icon="pi pi-plus"
              [outlined]="true"
              (onClick)="addColumn()"
            />
          </div>

          <div
            cdkDropList
            (cdkDropListDropped)="onColumnDrop($event)"
            class="space-y-2"
          >
            @for (col of columns(); track col.id; let i = $index) {
              <div
                cdkDrag
                class="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-move"
              >
                <i
                  class="pi pi-bars text-gray-400 cursor-move"
                  cdkDragHandle
                ></i>

                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  [style.background-color]="col.color || '#6366f1'"
                ></div>

                <span
                  class="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100"
                  >{{ col.name }}</span
                >

                @if (col.status_mapping?.['done']) {
                  <span class="text-xs text-green-500 font-medium">Done</span>
                }

                <button
                  pButton
                  [rounded]="true"
                  [text]="true"
                  severity="secondary"
                  (click)="renameColumn(col)"
                >
                  <i class="pi pi-pencil !text-[18px] text-gray-400"></i>
                </button>
                <button
                  pButton
                  [rounded]="true"
                  [text]="true"
                  severity="secondary"
                  (click)="deleteColumn(col)"
                >
                  <i
                    class="pi pi-trash !text-[18px] text-gray-400 hover:text-red-500"
                  ></i>
                </button>
              </div>
            }
          </div>

          @if (columns().length === 0) {
            <p class="text-sm text-gray-400 text-center py-4">
              No columns yet. Add one above.
            </p>
          }
        </section>

        <!-- Members section -->
        <section
          class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Project Members ({{ members().length }})
            </h2>
          </div>

          @if (workspaceId && canManageMembers()) {
            <app-member-picker
              [workspaceId]="workspaceId"
              [excludeUserIds]="memberUserIds()"
              label="Add project member"
              placeholder="Search workspace members..."
              (memberSelected)="addMemberFromPicker($event)"
            />
          }

          <div class="divide-y divide-gray-200 dark:divide-gray-800">
            @for (member of members(); track member.user_id) {
              <div class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm text-white font-medium"
                  >
                    {{ member.name.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      {{ member.name }}
                    </div>
                    <div class="text-xs text-gray-500">{{ member.email }}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="text-xs px-2 py-0.5 rounded-full font-medium"
                    [class]="
                      member.role === 'editor'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    "
                  >
                    {{ member.role }}
                  </span>
                  @if (canManageMembers()) {
                    <button
                      pButton
                      [rounded]="true"
                      [text]="true"
                      severity="secondary"
                      (click)="removeMember(member.user_id)"
                    >
                      <i
                        class="pi pi-user-minus !text-[18px] text-gray-400 hover:text-red-500"
                      ></i>
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          @if (members().length === 0) {
            <p class="text-sm text-gray-400 text-center py-4">
              No members yet.
            </p>
          }
        </section>

        <!-- Danger zone -->
        @if (canManageMembers()) {
          <section
            class="bg-white dark:bg-gray-900 rounded-lg border border-red-200 dark:border-red-900 p-6 space-y-4"
          >
            <h2 class="text-lg font-semibold text-red-600">Danger Zone</h2>
            <div class="flex gap-4">
              <div>
                <p class="text-sm text-gray-500 mb-2">
                  Archive this project to hide it from the sidebar.
                </p>
                <p-button
                  label="Archive Project"
                  icon="pi pi-inbox"
                  severity="warn"
                  [outlined]="true"
                  (onClick)="archiveProject()"
                />
              </div>
              <div>
                <p class="text-sm text-gray-500 mb-2">
                  Permanently delete this project and all its data.
                </p>
                <p-button
                  label="Delete Project"
                  icon="pi pi-trash"
                  severity="danger"
                  (onClick)="deleteProject()"
                />
              </div>
            </div>
          </section>
        }
      }
    </div>
  `,
})
export class ProjectSettingsComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  private subscriptions: Subscription[] = [];
  private projectId = '';
  workspaceId = '';

  project = signal<Project | null>(null);
  columns = signal<ProjectColumn[]>([]);
  members = signal<ProjectMemberInfo[]>([]);
  loading = signal(true);

  projectName = '';
  projectDescription = '';
  projectColor = '';
  projectIcon = '';

  currentUser = this.authService.currentUser;
  canManageMembers = computed(() => {
    const role = this.currentUser()?.role;
    return role === 'Admin' || role === 'Manager';
  });

  memberUserIds = computed(() => this.members().map((m) => m.user_id));

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe((params) => {
      this.projectId = params.get('projectId') || '';
      this.workspaceId = params.get('workspaceId') || '';
      if (this.projectId) {
        this.loadProjectSettings();
      }
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  saveProject(): void {
    this.projectService
      .update(this.projectId, {
        name: this.projectName.trim(),
        description: this.projectDescription.trim() || undefined,
        color: this.projectColor.trim() || undefined,
        icon: this.projectIcon.trim() || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.project.set(updated);
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: 'Project updated.',
            life: 2000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update project.',
            life: 3000,
          });
        },
      });
  }

  addColumn(): void {
    const name = prompt('Column name:');
    if (!name?.trim()) return;

    const color = prompt('Column color (hex, e.g. #6366f1):', '#6366f1');

    this.projectService
      .addColumn(this.projectId, {
        name: name.trim(),
        color: color?.trim() || undefined,
      })
      .subscribe({
        next: (col) => {
          this.columns.update((list) => [...list, col]);
          this.messageService.add({
            severity: 'success',
            summary: 'Added',
            detail: 'Column added.',
            life: 2000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to add column.',
            life: 3000,
          });
        },
      });
  }

  renameColumn(col: ProjectColumn): void {
    const name = prompt('New column name:', col.name);
    if (!name?.trim() || name.trim() === col.name) return;

    this.projectService.renameColumn(col.id, name.trim()).subscribe({
      next: (updated) => {
        this.columns.update((list) =>
          list.map((c) => (c.id === col.id ? updated : c)),
        );
        this.messageService.add({
          severity: 'success',
          summary: 'Renamed',
          detail: 'Column renamed.',
          life: 2000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to rename column.',
          life: 3000,
        });
      },
    });
  }

  deleteColumn(col: ProjectColumn): void {
    if (
      !confirm(
        `Delete column "${col.name}"? Tasks in this column may be affected.`,
      )
    )
      return;

    this.projectService.deleteColumn(col.id).subscribe({
      next: () => {
        this.columns.update((list) => list.filter((c) => c.id !== col.id));
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Column deleted.',
          life: 2000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete column.',
          life: 3000,
        });
      },
    });
  }

  onColumnDrop(event: CdkDragDrop<ProjectColumn[]>): void {
    const cols = [...this.columns()];
    moveItemInArray(cols, event.previousIndex, event.currentIndex);
    this.columns.set(cols);

    const moved = cols[event.currentIndex];
    const afterId =
      event.currentIndex > 0 ? cols[event.currentIndex - 1].id : null;
    const beforeId =
      event.currentIndex < cols.length - 1
        ? cols[event.currentIndex + 1].id
        : null;

    this.projectService.reorderColumn(moved.id, afterId, beforeId).subscribe({
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to reorder column. Reload the page.',
          life: 3000,
        });
      },
    });
  }

  addMemberFromPicker(member: MemberSearchResult): void {
    this.projectService
      .addMember(this.projectId, member.id, 'editor')
      .subscribe({
        next: () => {
          // Reload members to get full info with project role
          this.projectService.listMembers(this.projectId).subscribe({
            next: (members) => this.members.set(members),
          });
          this.messageService.add({
            severity: 'success',
            summary: 'Added',
            detail: `${member.name} added as editor.`,
            life: 2000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to add member.',
            life: 3000,
          });
        },
      });
  }

  removeMember(userId: string): void {
    if (!confirm('Remove this member from the project?')) return;

    this.projectService.removeMember(this.projectId, userId).subscribe({
      next: () => {
        this.members.update((list) => list.filter((m) => m.user_id !== userId));
        this.messageService.add({
          severity: 'success',
          summary: 'Removed',
          detail: 'Member removed.',
          life: 2000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to remove member.',
          life: 3000,
        });
      },
    });
  }

  archiveProject(): void {
    const proj = this.project();
    if (!proj) return;
    if (!confirm(`Archive "${proj.name}"? It will be hidden from the sidebar.`))
      return;

    this.projectService.archive(this.projectId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Archived',
          detail: 'Project archived.',
          life: 2000,
        });
        this.router.navigate(['/workspace', this.workspaceId]);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to archive project.',
          life: 3000,
        });
      },
    });
  }

  deleteProject(): void {
    const proj = this.project();
    if (!proj) return;
    if (
      !confirm(
        `Are you sure you want to delete "${proj.name}"? This cannot be undone.`,
      )
    )
      return;

    this.projectService.delete(this.projectId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Project deleted.',
          life: 2000,
        });
        this.router.navigate(['/workspace', this.workspaceId]);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete project.',
          life: 3000,
        });
      },
    });
  }

  private loadProjectSettings(): void {
    this.loading.set(true);

    forkJoin({
      project: this.projectService.getById(this.projectId),
      columns: this.projectService.listColumns(this.projectId),
      members: this.projectService.listMembers(this.projectId),
    }).subscribe({
      next: ({ project, columns, members }) => {
        this.project.set(project);
        this.projectName = project.name;
        this.projectDescription = project.description || '';
        this.projectColor = project.color || '#6366f1';
        this.projectIcon = project.icon || 'folder';
        this.columns.set(columns);
        this.members.set(members);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load project settings.',
          life: 3000,
        });
      },
    });
  }
}

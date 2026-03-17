import {
  Component,
  inject,
  signal,
  input,
  output,
  model,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { AutoComplete } from 'primeng/autocomplete';
import { MessageService } from 'primeng/api';
import {
  TeamGroupsService,
  TeamGroupDetail,
  TeamGroupMember,
} from '../../../core/services/team-groups.service';
import {
  WorkspaceService,
  MemberSearchResult,
} from '../../../core/services/workspace.service';

const PRESET_COLORS = [
  '#6366F1',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
];

@Component({
  selector: 'app-team-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    Textarea,
    AutoComplete,
  ],
  template: `
    <p-dialog
      [header]="editTeam() ? 'Edit Team' : 'Create Team'"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '520px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <!-- Team Name -->
        <div class="flex flex-col gap-1 mb-4">
          <label
            for="teamName"
            class="text-sm font-medium text-[var(--foreground)]"
            >Team Name</label
          >
          <input
            pInputText
            id="teamName"
            formControlName="name"
            placeholder="e.g., Design, Engineering"
            maxlength="100"
            class="w-full"
          />
          @if (
            form.get('name')?.hasError('required') && form.get('name')?.touched
          ) {
            <small class="text-red-500">Team name is required</small>
          }
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1 mb-4">
          <label
            for="teamDesc"
            class="text-sm font-medium text-[var(--foreground)]"
            >Description (optional)</label
          >
          <textarea
            pTextarea
            id="teamDesc"
            formControlName="description"
            placeholder="What does this team do?"
            rows="2"
            maxlength="500"
            class="w-full"
          ></textarea>
        </div>

        <!-- Color Picker -->
        <div class="flex flex-col gap-1 mb-4">
          <label class="text-sm font-medium text-[var(--foreground)]"
            >Color</label
          >
          <div class="flex gap-2 flex-wrap">
            @for (color of presetColors; track color) {
              <button
                type="button"
                [attr.aria-label]="'Select color ' + color"
                class="w-8 h-8 rounded-full border-2 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                [style.background-color]="color"
                [style.border-color]="
                  selectedColor() === color
                    ? 'var(--foreground)'
                    : 'transparent'
                "
                [style.transform]="
                  selectedColor() === color ? 'scale(1.15)' : 'scale(1)'
                "
                (click)="selectColor(color)"
              ></button>
            }
          </div>
        </div>

        <!-- Members (autocomplete) -->
        <div class="flex flex-col gap-1 mb-4">
          <label class="text-sm font-medium text-[var(--foreground)]"
            >Members</label
          >
          <p-autocomplete
            #memberAc
            [suggestions]="memberSuggestions()"
            (completeMethod)="searchMembers($event)"
            (onSelect)="onMemberSelected($event)"
            optionLabel="name"
            placeholder="Search workspace members..."
            [style]="{ width: '100%' }"
            [inputStyle]="{ width: '100%' }"
            [forceSelection]="true"
          >
            <ng-template let-item #item>
              <div class="flex items-center gap-2 py-1">
                <div
                  class="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary"
                >
                  {{ item.name?.charAt(0)?.toUpperCase() }}
                </div>
                <div>
                  <div class="text-sm text-[var(--foreground)]">
                    {{ item.name }}
                  </div>
                  <div class="text-xs text-[var(--muted-foreground)]">
                    {{ item.email }}
                  </div>
                </div>
              </div>
            </ng-template>
          </p-autocomplete>

          <!-- Selected members list -->
          @if (selectedMembers().length > 0) {
            <div class="mt-2 flex flex-col gap-1">
              @for (member of selectedMembers(); track member.user_id) {
                <div
                  class="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--secondary)] border border-[var(--border)]"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary"
                    >
                      {{ member.name.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <div class="text-sm text-[var(--foreground)]">
                        {{ member.name }}
                      </div>
                      <div class="text-xs text-[var(--muted-foreground)]">
                        {{ member.email }}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    [attr.aria-label]="'Remove ' + member.name"
                    class="p-1 rounded hover:bg-[var(--card)] transition-colors cursor-pointer"
                    (click)="removeMember(member.user_id)"
                  >
                    <svg
                      class="w-4 h-4 text-[var(--muted-foreground)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </form>

      <ng-template #footer>
        <div class="flex justify-between w-full">
          <div>
            @if (editTeam()) {
              <p-button
                label="Delete Team"
                severity="danger"
                [text]="true"
                (onClick)="onDelete()"
                [disabled]="isSubmitting()"
              />
            }
          </div>
          <div class="flex gap-2">
            <p-button
              label="Cancel"
              [text]="true"
              severity="secondary"
              (onClick)="onCancel()"
              [disabled]="isSubmitting()"
            />
            <p-button
              [label]="editTeam() ? 'Save Changes' : 'Create Team'"
              (onClick)="onSubmit()"
              [disabled]="form.invalid || isSubmitting()"
              [loading]="isSubmitting()"
            />
          </div>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class TeamDetailDialogComponent {
  private fb = inject(FormBuilder);
  private teamGroupsService = inject(TeamGroupsService);
  private workspaceService = inject(WorkspaceService);
  private messageService = inject(MessageService);

  private memberAc = viewChild<AutoComplete>('memberAc');

  visible = model(false);
  workspaceId = input.required<string>();
  editTeam = input<TeamGroupDetail | null>(null);

  saved = output<TeamGroupDetail>();
  deleted = output<string>();

  presetColors = PRESET_COLORS;
  selectedColor = signal('#6366F1');
  memberSuggestions = signal<MemberSearchResult[]>([]);
  selectedMembers = signal<{ user_id: string; name: string; email: string }[]>(
    [],
  );
  isSubmitting = signal(false);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
  });

  onDialogShow(): void {
    const team = this.editTeam();
    if (team) {
      this.form.patchValue({
        name: team.name,
        description: team.description ?? '',
      });
      this.selectedColor.set(team.color);
      this.selectedMembers.set(
        team.members.map((m) => ({
          user_id: m.user_id,
          name: m.name,
          email: m.email,
        })),
      );
    } else {
      this.form.reset({ name: '', description: '' });
      this.selectedColor.set('#6366F1');
      this.selectedMembers.set([]);
    }
  }

  selectColor(color: string): void {
    this.selectedColor.set(color);
  }

  searchMembers(event: { query: string }): void {
    if (!event.query || event.query.length < 2) {
      this.memberSuggestions.set([]);
      return;
    }

    this.workspaceService
      .searchMembers(this.workspaceId(), event.query)
      .subscribe({
        next: (results) => {
          // Filter out already selected members
          const selectedIds = new Set(
            this.selectedMembers().map((m) => m.user_id),
          );
          this.memberSuggestions.set(
            results.filter((r) => !selectedIds.has(r.id)),
          );
        },
        error: () => {
          this.memberSuggestions.set([]);
        },
      });
  }

  onMemberSelected(event: { value: MemberSearchResult }): void {
    const member = event.value;
    if (!member) return;

    const already = this.selectedMembers().some((m) => m.user_id === member.id);
    if (!already) {
      this.selectedMembers.update((list) => [
        ...list,
        { user_id: member.id, name: member.name, email: member.email },
      ]);
    }

    // Clear the autocomplete input after selection
    const ac = this.memberAc();
    if (ac) {
      ac.clear();
    }
  }

  removeMember(userId: string): void {
    this.selectedMembers.update((list) =>
      list.filter((m) => m.user_id !== userId),
    );
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onDelete(): void {
    const team = this.editTeam();
    if (!team) return;

    if (!confirm('Are you sure you want to delete this team?')) return;

    this.isSubmitting.set(true);
    this.teamGroupsService.deleteTeam(team.id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.visible.set(false);
        this.deleted.emit(team.id);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Could not delete team',
        });
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const team = this.editTeam();
    const payload = {
      name: this.form.value.name.trim(),
      description: this.form.value.description?.trim() || undefined,
      color: this.selectedColor(),
    };

    const request$ = team
      ? this.teamGroupsService.updateTeam(team.id, payload)
      : this.teamGroupsService.createTeam(this.workspaceId(), payload);

    request$.subscribe({
      next: (result) => {
        // Sync members: add new ones, remove old ones
        this.syncMembers(result.id, team?.members ?? []).then(
          (failureCount) => {
            if (failureCount > 0) {
              this.messageService.add({
                severity: 'warn',
                summary: 'Warning',
                detail: `Team saved, but ${failureCount} member update(s) failed`,
              });
            }
            // Re-fetch the team to get fresh member list
            this.teamGroupsService.getTeam(result.id).subscribe({
              next: (freshTeam) => {
                this.isSubmitting.set(false);
                this.visible.set(false);
                this.saved.emit(freshTeam);
              },
              error: () => {
                this.isSubmitting.set(false);
                this.visible.set(false);
                this.saved.emit(result);
              },
            });
          },
        );
      },
      error: () => {
        this.isSubmitting.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Could not save team',
        });
      },
    });
  }

  private async syncMembers(
    teamId: string,
    existingMembers: TeamGroupMember[],
  ): Promise<number> {
    const existingIds = new Set(existingMembers.map((m) => m.user_id));
    const selectedIds = new Set(this.selectedMembers().map((m) => m.user_id));

    // Add new members
    const toAdd = this.selectedMembers().filter(
      (m) => !existingIds.has(m.user_id),
    );
    // Remove old members
    const toRemove = existingMembers.filter((m) => !selectedIds.has(m.user_id));

    let failureCount = 0;
    const promises: Promise<void>[] = [];

    for (const member of toAdd) {
      promises.push(
        new Promise<void>((resolve) => {
          this.teamGroupsService.addMember(teamId, member.user_id).subscribe({
            next: () => resolve(),
            error: () => {
              failureCount++;
              resolve();
            },
          });
        }),
      );
    }

    for (const member of toRemove) {
      promises.push(
        new Promise<void>((resolve) => {
          this.teamGroupsService
            .removeMember(teamId, member.user_id)
            .subscribe({
              next: () => resolve(),
              error: () => {
                failureCount++;
                resolve();
              },
            });
        }),
      );
    }

    await Promise.all(promises);
    return failureCount;
  }
}

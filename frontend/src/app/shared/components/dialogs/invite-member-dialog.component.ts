import {
  Component,
  inject,
  signal,
  input,
  output,
  model,
  computed,
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
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../../core/services/project.service';
import {
  AddableMember,
  Workspace,
  WorkspaceService,
} from '../../../core/services/workspace.service';

export interface InviteMemberDialogData {
  workspaceId: string;
  workspaceName: string;
  boards: { id: string; name: string }[];
}

export interface InviteMemberDialogResult {
  emails: string[];
  role: 'admin' | 'manager' | 'member';
  boardIds: string[];
  message?: string;
  jobTitle?: string;
  workspaceId?: string;
}

/** Result emitted when caller picks existing tenant users to bulk-add (no email). */
export interface AddExistingMembersResult {
  userIds: string[];
  workspaceId: string;
}

interface EmailValidation {
  email: string;
  valid: boolean;
  error?: string;
}

@Component({
  selector: 'app-invite-member-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    Textarea,
    Select,
    Checkbox,
  ],
  template: `
    <p-dialog
      header="Invite Members"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '520px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      @if (effectiveWorkspaceName()) {
        <p class="text-sm text-[var(--muted-foreground)] mb-4">
          Invite new members to {{ effectiveWorkspaceName() }}
        </p>
      }

      <!-- Mode toggle: send email invite vs add existing org user -->
      <div
        class="inline-flex rounded-lg border border-[var(--border)] p-0.5 mb-4"
      >
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md transition-colors"
          [class]="
            mode() === 'invite'
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          "
          (click)="setMode('invite')"
        >
          Invite by email
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md transition-colors"
          [class]="
            mode() === 'add_existing'
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          "
          (click)="setMode('add_existing')"
        >
          Add from organization
        </button>
      </div>

      @if (mode() === 'add_existing') {
        <div class="flex flex-col gap-2 mb-2">
          @if (loadingAddable()) {
            <p class="text-sm text-[var(--muted-foreground)]">Loading…</p>
          } @else if (addableMembers().length === 0) {
            <p class="text-sm text-[var(--muted-foreground)]">
              Everyone in your organization is already a member of this workspace.
            </p>
          } @else {
            <div
              class="border border-[var(--border)] rounded-lg p-2 max-h-64 overflow-y-auto"
            >
              @for (m of addableMembers(); track m.id) {
                <div class="flex items-center gap-2 py-1">
                  <p-checkbox
                    [binary]="true"
                    [ngModel]="isExistingSelected(m.id)"
                    [ngModelOptions]="{ standalone: true }"
                    (onChange)="toggleExisting(m.id, $event.checked)"
                    [inputId]="'existing-' + m.id"
                  />
                  <label
                    [for]="'existing-' + m.id"
                    class="flex-1 cursor-pointer text-sm text-[var(--foreground)]"
                    >{{ m.name }}
                    <span class="text-[var(--muted-foreground)]">
                      &lt;{{ m.email }}&gt;</span
                    ></label
                  >
                </div>
              }
            </div>
            <p class="text-xs text-[var(--muted-foreground)]">
              {{ selectedExistingIds().length }} selected
            </p>
          }
        </div>
      }
      @if (mode() === 'invite') {
      <form [formGroup]="form">
        <!-- Workspace Selector (shown when multiple workspaces available) -->
        @if (showWorkspaceSelector()) {
          <div class="flex flex-col gap-1 mb-4">
            <label
              for="workspace"
              class="text-sm font-medium text-[var(--foreground)]"
              >Workspace</label
            >
            <p-select
              [options]="workspaceOptions()"
              [ngModel]="internalWorkspaceId()"
              (ngModelChange)="onWorkspaceChange($event)"
              [ngModelOptions]="{ standalone: true }"
              optionLabel="label"
              optionValue="value"
              placeholder="Select a workspace"
              class="w-full"
            />
          </div>
        }

        <!-- Bulk Email Input -->
        <div class="flex flex-col gap-1 mb-4">
          <label
            for="emailsText"
            class="text-sm font-medium text-[var(--foreground)]"
            >Email Addresses</label
          >
          <textarea
            pTextarea
            id="emailsText"
            formControlName="emailsText"
            placeholder="Enter emails separated by commas or new lines&#10;e.g. alice@example.com, bob@example.com"
            rows="4"
            class="w-full"
            (blur)="validateEmails()"
          ></textarea>
          <small class="text-[var(--muted-foreground)]"
            >Enter one email per line or separate with commas</small
          >
          @if (
            form.get('emailsText')?.hasError('required') &&
            form.get('emailsText')?.touched
          ) {
            <small class="text-[var(--destructive)]">At least one email is required</small>
          }
        </div>

        <!-- Parsed emails preview -->
        @if (parsedEmails().length > 0) {
          <div class="mb-4">
            <div
              class="text-xs font-medium text-[var(--muted-foreground)] mb-2"
            >
              {{ validEmailCount() }} valid email{{
                validEmailCount() !== 1 ? 's' : ''
              }}
              found
              @if (invalidEmailCount() > 0) {
                <span class="text-[var(--destructive)] ml-1">
                  ({{ invalidEmailCount() }} invalid)
                </span>
              }
            </div>
            <div class="flex flex-wrap gap-1.5">
              @for (item of parsedEmails(); track item.email) {
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  [style]="{
                    background: item.valid
                      ? 'var(--status-green-bg)'
                      : 'var(--status-red-bg)',
                    color: item.valid
                      ? 'var(--status-green-text)'
                      : 'var(--status-red-text)',
                    border: item.valid
                      ? '1px solid var(--status-green-border)'
                      : '1px solid var(--status-red-border)',
                  }"
                  [title]="item.error || item.email"
                >
                  {{ item.email }}
                  @if (!item.valid) {
                    <svg
                      class="w-3 h-3 text-[var(--destructive)]"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  }
                </span>
              }
            </div>
          </div>
        }

        <!-- Role Selection -->
        <div class="flex flex-col gap-1 mb-4">
          <label
            for="role"
            class="text-sm font-medium text-[var(--foreground)]"
            >Role</label
          >
          <p-select
            formControlName="role"
            [options]="roleOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select a role"
            class="w-full"
          />
        </div>

        <!-- Job Title (optional) -->
        <div class="flex flex-col gap-1 mb-4">
          <label
            for="jobTitle"
            class="text-sm font-medium text-[var(--foreground)]"
            >Job Title (optional)</label
          >
          <input
            pInputText
            id="jobTitle"
            formControlName="jobTitle"
            placeholder="e.g. Product Designer, Backend Engineer"
            class="w-full"
          />
          <small class="text-[var(--muted-foreground)]"
            >Pre-fill a job title for the invitee(s)</small
          >
        </div>

        <!-- Board Access Selection -->
        @if (effectiveBoards().length > 0) {
          <div class="mb-4">
            <label
              class="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              Board Access
            </label>
            <p class="text-xs text-[var(--muted-foreground)] mb-2">
              Select which boards the invited members should have access to
            </p>
            <div
              class="border border-[var(--border)] rounded-lg p-3 max-h-48 overflow-y-auto space-y-1"
            >
              <div class="mb-2 flex items-center gap-2">
                <p-checkbox
                  [binary]="true"
                  [ngModel]="allBoardsSelected()"
                  [ngModelOptions]="{ standalone: true }"
                  (onChange)="toggleAllBoards($event.checked)"
                  inputId="selectAll"
                />
                <label
                  for="selectAll"
                  class="text-sm font-medium text-[var(--foreground)] cursor-pointer"
                  >Select All</label
                >
              </div>
              @for (
                board of effectiveBoards();
                track board.id;
                let i = $index
              ) {
                <div class="flex items-center gap-2">
                  <p-checkbox
                    [binary]="true"
                    [ngModel]="isBoardSelected(board.id)"
                    [ngModelOptions]="{ standalone: true }"
                    (onChange)="toggleBoard(board.id, $event.checked)"
                    [inputId]="'board-' + i"
                  />
                  <label
                    [for]="'board-' + i"
                    class="text-sm text-[var(--foreground)] cursor-pointer"
                    >{{ board.name }}</label
                  >
                </div>
              }
            </div>
            @if (selectedBoardIds().length > 0) {
              <p class="text-xs text-[var(--muted-foreground)] mt-1">
                {{ selectedBoardIds().length }} board{{
                  selectedBoardIds().length !== 1 ? 's' : ''
                }}
                selected
              </p>
            }
          </div>
        }

        <!-- Welcome Message -->
        <div class="flex flex-col gap-1">
          <label
            for="message"
            class="text-sm font-medium text-[var(--foreground)]"
            >Welcome Message (optional)</label
          >
          <textarea
            pTextarea
            id="message"
            formControlName="message"
            placeholder="Add a personal welcome message for the invitees..."
            rows="3"
            class="w-full"
          ></textarea>
          <small class="text-[var(--muted-foreground)]"
            >This message will be included in the invitation email</small
          >
        </div>
      </form>
      }

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="onCancel()"
            [disabled]="isSubmitting"
          />
          <p-button
            [label]="submitLabel()"
            (onClick)="onSubmit()"
            [disabled]="!canSubmit() || isSubmitting"
            [loading]="isSubmitting"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class InviteMemberDialogComponent {
  private fb = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private workspaceService = inject(WorkspaceService);

  /** Two-way bound visibility */
  visible = model(false);

  /** Input data for the dialog */
  workspaceId = input<string>('');
  workspaceName = input<string>('');
  boards = input<{ id: string; name: string }[]>([]);

  /** Optional: pass available workspaces for embedded workspace selection */
  workspaces = input<Workspace[]>([]);

  /** Emits result when dialog closes with a value */
  created = output<InviteMemberDialogResult>();

  /** Emits when caller picked existing tenant users (no email path). */
  addedExisting = output<AddExistingMembersResult>();

  /** Mode: 'invite' (email path) or 'add_existing' (pick from tenant). */
  mode = signal<'invite' | 'add_existing'>('invite');
  addableMembers = signal<AddableMember[]>([]);
  loadingAddable = signal(false);
  selectedExistingIds = signal<string[]>([]);

  form: FormGroup = this.fb.group({
    emailsText: ['', [Validators.required]],
    role: ['member', [Validators.required]],
    jobTitle: [''],
    message: [''],
  });

  parsedEmails = signal<EmailValidation[]>([]);
  selectedBoardIds = signal<string[]>([]);
  isSubmitting = false;

  /** Internal workspace selection (when workspaces list is provided) */
  internalWorkspaceId = signal<string | null>(null);
  dynamicBoards = signal<{ id: string; name: string }[]>([]);
  loadingBoards = signal(false);

  /** Whether the dialog needs to show a workspace picker */
  showWorkspaceSelector = computed(
    () => this.workspaces().length > 0 && !this.workspaceId(),
  );

  workspaceOptions = computed(() =>
    this.workspaces().map((ws) => ({ label: ws.name, value: ws.id })),
  );

  /** Effective workspace name for the header */
  effectiveWorkspaceName = computed(() => {
    if (this.workspaceName()) return this.workspaceName();
    const wsId = this.internalWorkspaceId();
    if (!wsId) return '';
    return this.workspaces().find((ws) => ws.id === wsId)?.name ?? '';
  });

  /** Effective boards list: external input or dynamically loaded */
  effectiveBoards = computed(() => {
    if (this.boards().length > 0) return this.boards();
    return this.dynamicBoards();
  });

  roleOptions = [
    { label: 'Member - Can view and edit boards', value: 'member' },
    { label: 'Manager - Can manage boards and assign tasks', value: 'manager' },
    { label: 'Admin - Can manage members and settings', value: 'admin' },
  ];

  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  onDialogShow(): void {
    this.form.reset({
      emailsText: '',
      role: 'member',
      jobTitle: '',
      message: '',
    });
    this.parsedEmails.set([]);
    this.selectedBoardIds.set([]);
    this.internalWorkspaceId.set(null);
    this.dynamicBoards.set([]);
    this.mode.set('invite');
    this.addableMembers.set([]);
    this.selectedExistingIds.set([]);
  }

  setMode(mode: 'invite' | 'add_existing'): void {
    this.mode.set(mode);
    if (mode === 'add_existing') {
      this.loadAddableMembers();
    }
  }

  private loadAddableMembers(): void {
    const wsId =
      this.workspaceId() || this.internalWorkspaceId() || undefined;
    if (!wsId) {
      this.addableMembers.set([]);
      return;
    }
    this.loadingAddable.set(true);
    this.workspaceService.listAddableMembers(wsId).subscribe({
      next: (members) => {
        this.addableMembers.set(members);
        this.loadingAddable.set(false);
      },
      error: () => {
        this.addableMembers.set([]);
        this.loadingAddable.set(false);
      },
    });
  }

  isExistingSelected(userId: string): boolean {
    return this.selectedExistingIds().includes(userId);
  }

  toggleExisting(userId: string, checked: boolean): void {
    this.selectedExistingIds.update((ids) =>
      checked ? [...ids, userId] : ids.filter((id) => id !== userId),
    );
  }

  submitLabel(): string {
    if (this.mode() === 'add_existing') {
      const n = this.selectedExistingIds().length;
      return n > 0 ? `Add ${n} member${n !== 1 ? 's' : ''}` : 'Add members';
    }
    const n = this.validEmailCount();
    return (
      'Send Invitation' + (n > 1 ? 's' : '') + (n > 0 ? ' (' + n + ')' : '')
    );
  }

  onWorkspaceChange(wsId: string | null): void {
    this.internalWorkspaceId.set(wsId);
    this.selectedBoardIds.set([]);
    this.dynamicBoards.set([]);
    if (wsId) {
      this.loadingBoards.set(true);
      this.projectService.listBoards(wsId).subscribe({
        next: (boards) => {
          this.dynamicBoards.set(
            boards.map((b) => ({ id: b.id, name: b.name })),
          );
          this.loadingBoards.set(false);
        },
        error: () => {
          this.dynamicBoards.set([]);
          this.loadingBoards.set(false);
        },
      });
    }
  }

  validEmailCount(): number {
    return this.parsedEmails().filter((e) => e.valid).length;
  }

  invalidEmailCount(): number {
    return this.parsedEmails().filter((e) => !e.valid).length;
  }

  canSubmit(): boolean {
    if (this.mode() === 'add_existing') {
      const wsId =
        this.workspaceId() || this.internalWorkspaceId() || undefined;
      return !!wsId && this.selectedExistingIds().length > 0;
    }
    const hasValidEmails =
      this.form.get('role')?.valid === true && this.validEmailCount() > 0;
    if (this.showWorkspaceSelector()) {
      return hasValidEmails && !!this.internalWorkspaceId();
    }
    return hasValidEmails;
  }

  isBoardSelected(boardId: string): boolean {
    return this.selectedBoardIds().includes(boardId);
  }

  allBoardsSelected(): boolean {
    return (
      this.effectiveBoards().length > 0 &&
      this.selectedBoardIds().length === this.effectiveBoards().length
    );
  }

  toggleBoard(boardId: string, checked: boolean): void {
    this.selectedBoardIds.update((ids) =>
      checked ? [...ids, boardId] : ids.filter((id) => id !== boardId),
    );
  }

  toggleAllBoards(checked: boolean): void {
    if (checked) {
      this.selectedBoardIds.set(this.effectiveBoards().map((b) => b.id));
    } else {
      this.selectedBoardIds.set([]);
    }
  }

  validateEmails(): void {
    const text = this.form.get('emailsText')?.value || '';
    const rawEmails = text
      .split(/[,\n;]+/)
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.length > 0);

    // Deduplicate
    const unique = [...new Set<string>(rawEmails)];

    const validations: EmailValidation[] = unique.map((email) => {
      if (!this.emailRegex.test(email)) {
        return { email, valid: false, error: 'Invalid email format' };
      }
      return { email, valid: true };
    });

    this.parsedEmails.set(validations);
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onSubmit(): void {
    if (this.mode() === 'add_existing') {
      if (!this.canSubmit()) return;
      const wsId =
        this.workspaceId() || this.internalWorkspaceId() || '';
      const result: AddExistingMembersResult = {
        userIds: [...this.selectedExistingIds()],
        workspaceId: wsId,
      };
      this.visible.set(false);
      this.addedExisting.emit(result);
      return;
    }

    this.validateEmails();

    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }

    const validEmails = this.parsedEmails()
      .filter((e) => e.valid)
      .map((e) => e.email);

    const resolvedWorkspaceId =
      this.workspaceId() || this.internalWorkspaceId() || undefined;

    const result: InviteMemberDialogResult = {
      emails: validEmails,
      role: this.form.value.role,
      boardIds: this.selectedBoardIds(),
      message: this.form.value.message?.trim() || undefined,
      jobTitle: this.form.value.jobTitle?.trim() || undefined,
      workspaceId: resolvedWorkspaceId,
    };

    this.visible.set(false);
    this.created.emit(result);
  }
}

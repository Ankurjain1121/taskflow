import { Component, inject, signal, input, output, model } from '@angular/core';
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
}

interface EmailValidation {
  email: string;
  valid: boolean;
  error?: string;
}

@Component({
  selector: 'app-invite-member-dialog',
  standalone: true,
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
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Invite new members to {{ workspaceName() }}
      </p>
      <form [formGroup]="form">
        <!-- Bulk Email Input -->
        <div class="flex flex-col gap-1 mb-4">
          <label
            for="emailsText"
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
          <small class="text-gray-500 dark:text-gray-400"
            >Enter one email per line or separate with commas</small
          >
          @if (
            form.get('emailsText')?.hasError('required') &&
            form.get('emailsText')?.touched
          ) {
            <small class="text-red-500">At least one email is required</small>
          }
        </div>

        <!-- Parsed emails preview -->
        @if (parsedEmails().length > 0) {
          <div class="mb-4">
            <div
              class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2"
            >
              {{ validEmailCount() }} valid email{{
                validEmailCount() !== 1 ? 's' : ''
              }}
              found
              @if (invalidEmailCount() > 0) {
                <span class="text-red-500 ml-1">
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
                      class="w-3 h-3 text-red-500"
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
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
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

        <!-- Board Access Selection -->
        @if (boards() && boards().length > 0) {
          <div class="mb-4">
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Board Access
            </label>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Select which boards the invited members should have access to
            </p>
            <div
              class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1"
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
                  class="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                  >Select All</label
                >
              </div>
              @for (board of boards(); track board.id; let i = $index) {
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
                    class="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                    >{{ board.name }}</label
                  >
                </div>
              }
            </div>
            @if (selectedBoardIds().length > 0) {
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
            class="text-sm font-medium text-gray-700 dark:text-gray-300"
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
          <small class="text-gray-500 dark:text-gray-400"
            >This message will be included in the invitation email</small
          >
        </div>
      </form>

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
            [label]="
              'Send Invitation' +
              (validEmailCount() > 1 ? 's' : '') +
              (validEmailCount() > 0 ? ' (' + validEmailCount() + ')' : '')
            "
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

  /** Two-way bound visibility */
  visible = model(false);

  /** Input data for the dialog */
  workspaceId = input<string>('');
  workspaceName = input<string>('');
  boards = input<{ id: string; name: string }[]>([]);

  /** Emits result when dialog closes with a value */
  created = output<InviteMemberDialogResult>();

  form: FormGroup = this.fb.group({
    emailsText: ['', [Validators.required]],
    role: ['member', [Validators.required]],
    message: [''],
  });

  parsedEmails = signal<EmailValidation[]>([]);
  selectedBoardIds = signal<string[]>([]);
  isSubmitting = false;

  roleOptions = [
    { label: 'Member - Can view and edit boards', value: 'member' },
    { label: 'Manager - Can manage boards and assign tasks', value: 'manager' },
    { label: 'Admin - Can manage members and settings', value: 'admin' },
  ];

  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  onDialogShow(): void {
    this.form.reset({ emailsText: '', role: 'member', message: '' });
    this.parsedEmails.set([]);
    this.selectedBoardIds.set([]);
  }

  validEmailCount(): number {
    return this.parsedEmails().filter((e) => e.valid).length;
  }

  invalidEmailCount(): number {
    return this.parsedEmails().filter((e) => !e.valid).length;
  }

  canSubmit(): boolean {
    return this.form.get('role')?.valid === true && this.validEmailCount() > 0;
  }

  isBoardSelected(boardId: string): boolean {
    return this.selectedBoardIds().includes(boardId);
  }

  allBoardsSelected(): boolean {
    return (
      this.boards()?.length > 0 &&
      this.selectedBoardIds().length === this.boards().length
    );
  }

  toggleBoard(boardId: string, checked: boolean): void {
    this.selectedBoardIds.update((ids) =>
      checked ? [...ids, boardId] : ids.filter((id) => id !== boardId),
    );
  }

  toggleAllBoards(checked: boolean): void {
    if (checked) {
      this.selectedBoardIds.set(this.boards().map((b) => b.id));
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
    this.validateEmails();

    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }

    const validEmails = this.parsedEmails()
      .filter((e) => e.valid)
      .map((e) => e.email);

    const result: InviteMemberDialogResult = {
      emails: validEmails,
      role: this.form.value.role,
      boardIds: this.selectedBoardIds(),
      message: this.form.value.message?.trim() || undefined,
    };

    this.visible.set(false);
    this.created.emit(result);
  }
}

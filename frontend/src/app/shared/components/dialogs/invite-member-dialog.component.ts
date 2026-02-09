import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';

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
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatIconModule,
    MatCheckboxModule,
  ],
  template: `
    <h2 mat-dialog-title>Invite Members</h2>
    <mat-dialog-content>
      <p class="text-sm text-gray-500 mb-4">
        Invite new members to {{ data.workspaceName }}
      </p>
      <form [formGroup]="form">
        <!-- Bulk Email Input -->
        <mat-form-field appearance="outline" class="w-full mb-2">
          <mat-label>Email Addresses</mat-label>
          <textarea
            matInput
            formControlName="emailsText"
            placeholder="Enter emails separated by commas or new lines&#10;e.g. alice&#64;example.com, bob&#64;example.com"
            rows="4"
            (blur)="validateEmails()"
          ></textarea>
          <mat-hint>Enter one email per line or separate with commas</mat-hint>
          @if (form.get('emailsText')?.hasError('required') && form.get('emailsText')?.touched) {
            <mat-error>At least one email is required</mat-error>
          }
        </mat-form-field>

        <!-- Parsed emails preview -->
        @if (parsedEmails().length > 0) {
          <div class="mb-4">
            <div class="text-xs font-medium text-gray-500 mb-2">
              {{ validEmailCount() }} valid email{{ validEmailCount() !== 1 ? 's' : '' }} found
              @if (invalidEmailCount() > 0) {
                <span class="text-red-500 ml-1">
                  ({{ invalidEmailCount() }} invalid)
                </span>
              }
            </div>
            <div class="flex flex-wrap gap-1.5">
              @for (item of parsedEmails(); track item.email) {
                <span
                  [class]="
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ' +
                    (item.valid
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200')
                  "
                  [title]="item.error || item.email"
                >
                  {{ item.email }}
                  @if (!item.valid) {
                    <svg class="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  }
                </span>
              }
            </div>
          </div>
        }

        <!-- Role Selection -->
        <mat-form-field appearance="outline" class="w-full mb-2">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="member">
              <div class="flex flex-col">
                <span class="font-medium">Member</span>
                <span class="text-xs text-gray-500">Can view and edit boards</span>
              </div>
            </mat-option>
            <mat-option value="manager">
              <div class="flex flex-col">
                <span class="font-medium">Manager</span>
                <span class="text-xs text-gray-500">Can manage boards and assign tasks</span>
              </div>
            </mat-option>
            <mat-option value="admin">
              <div class="flex flex-col">
                <span class="font-medium">Admin</span>
                <span class="text-xs text-gray-500">Can manage members and settings</span>
              </div>
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Board Access Selection -->
        @if (data.boards && data.boards.length > 0) {
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Board Access
            </label>
            <p class="text-xs text-gray-500 mb-2">
              Select which boards the invited members should have access to
            </p>
            <div class="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
              <div class="mb-2">
                <mat-checkbox
                  [checked]="allBoardsSelected()"
                  [indeterminate]="someBoardsSelected() && !allBoardsSelected()"
                  (change)="toggleAllBoards($event.checked)"
                  color="primary"
                >
                  <span class="text-sm font-medium text-gray-700">Select All</span>
                </mat-checkbox>
              </div>
              @for (board of data.boards; track board.id) {
                <div>
                  <mat-checkbox
                    [checked]="isBoardSelected(board.id)"
                    (change)="toggleBoard(board.id, $event.checked)"
                    color="primary"
                  >
                    <span class="text-sm text-gray-700">{{ board.name }}</span>
                  </mat-checkbox>
                </div>
              }
            </div>
            @if (selectedBoardIds().length > 0) {
              <p class="text-xs text-gray-500 mt-1">
                {{ selectedBoardIds().length }} board{{ selectedBoardIds().length !== 1 ? 's' : '' }} selected
              </p>
            }
          </div>
        }

        <!-- Welcome Message -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Welcome Message (optional)</mat-label>
          <textarea
            matInput
            formControlName="message"
            placeholder="Add a personal welcome message for the invitees..."
            rows="3"
          ></textarea>
          <mat-hint>This message will be included in the invitation email</mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="gap-2">
      <button mat-button (click)="onCancel()" [disabled]="isSubmitting">
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        (click)="onSubmit()"
        [disabled]="!canSubmit() || isSubmitting"
      >
        @if (isSubmitting) {
          <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
          Sending...
        } @else {
          Send Invitation{{ validEmailCount() > 1 ? 's' : '' }}
          @if (validEmailCount() > 0) {
            ({{ validEmailCount() }})
          }
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 460px;
      }

      mat-spinner {
        display: inline-block;
        margin-right: 8px;
      }
    `,
  ],
})
export class InviteMemberDialogComponent {
  data = inject<InviteMemberDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<InviteMemberDialogComponent>);
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    emailsText: ['', [Validators.required]],
    role: ['member', [Validators.required]],
    message: [''],
  });

  parsedEmails = signal<EmailValidation[]>([]);
  selectedBoardIds = signal<string[]>([]);
  isSubmitting = false;

  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validEmailCount(): number {
    return this.parsedEmails().filter((e) => e.valid).length;
  }

  invalidEmailCount(): number {
    return this.parsedEmails().filter((e) => !e.valid).length;
  }

  canSubmit(): boolean {
    return (
      this.form.get('role')?.valid === true &&
      this.validEmailCount() > 0
    );
  }

  isBoardSelected(boardId: string): boolean {
    return this.selectedBoardIds().includes(boardId);
  }

  allBoardsSelected(): boolean {
    return (
      this.data.boards?.length > 0 &&
      this.selectedBoardIds().length === this.data.boards.length
    );
  }

  someBoardsSelected(): boolean {
    return this.selectedBoardIds().length > 0;
  }

  toggleBoard(boardId: string, checked: boolean): void {
    this.selectedBoardIds.update((ids) =>
      checked ? [...ids, boardId] : ids.filter((id) => id !== boardId)
    );
  }

  toggleAllBoards(checked: boolean): void {
    if (checked) {
      this.selectedBoardIds.set(this.data.boards.map((b) => b.id));
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
    this.dialogRef.close();
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

    this.dialogRef.close(result);
  }
}

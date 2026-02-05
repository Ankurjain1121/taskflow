import { Component, inject } from '@angular/core';
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

export interface InviteMemberDialogData {
  workspaceId: string;
  workspaceName: string;
}

export interface InviteMemberDialogResult {
  email: string;
  role: 'admin' | 'member';
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
  ],
  template: `
    <h2 mat-dialog-title>Invite Member</h2>
    <mat-dialog-content>
      <p class="text-sm text-gray-500 mb-4">
        Invite a new member to {{ data.workspaceName }}
      </p>
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="w-full mb-4">
          <mat-label>Email Address</mat-label>
          <input
            matInput
            type="email"
            formControlName="email"
            placeholder="colleague@example.com"
          />
          @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
            <mat-error>Email is required</mat-error>
          }
          @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
            <mat-error>Please enter a valid email address</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="member">
              <div class="flex flex-col">
                <span class="font-medium">Member</span>
                <span class="text-xs text-gray-500">Can view and edit boards</span>
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
        [disabled]="form.invalid || isSubmitting"
      >
        @if (isSubmitting) {
          <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
          Sending...
        } @else {
          Send Invite
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 400px;
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
    email: ['', [Validators.required, Validators.email]],
    role: ['member', [Validators.required]],
  });

  isSubmitting = false;

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const result: InviteMemberDialogResult = {
      email: this.form.value.email.trim().toLowerCase(),
      role: this.form.value.role,
    };

    this.dialogRef.close(result);
  }
}

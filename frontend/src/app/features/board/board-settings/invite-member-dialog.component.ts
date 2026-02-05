import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

export interface InviteMemberDialogData {
  boardId: string;
  boardName: string;
}

export interface InviteMemberDialogResult {
  email: string;
  role: 'viewer' | 'editor';
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
  ],
  template: `
    <h2 mat-dialog-title>Invite Member</h2>
    <mat-dialog-content>
      <p class="text-gray-600 mb-4">
        Add a new member to "{{ data.boardName }}"
      </p>
      <form [formGroup]="form" class="flex flex-col gap-4">
        <mat-form-field appearance="outline">
          <mat-label>Email address</mat-label>
          <input
            matInput
            type="email"
            formControlName="email"
            placeholder="member@example.com"
          />
          @if (form.controls['email'].hasError('required')) {
            <mat-error>Email is required</mat-error>
          }
          @if (form.controls['email'].hasError('email')) {
            <mat-error>Please enter a valid email</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="viewer">Viewer - Can view board and tasks</mat-option>
            <mat-option value="editor">Editor - Can edit tasks and columns</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="form.invalid"
        (click)="onInvite()"
      >
        Send Invite
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        min-width: 400px;
      }
    `,
  ],
})
export class InviteMemberDialogComponent {
  data = inject<InviteMemberDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<InviteMemberDialogComponent>);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['editor' as 'viewer' | 'editor', Validators.required],
  });

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onInvite(): void {
    if (this.form.invalid) return;

    const result: InviteMemberDialogResult = {
      email: this.form.value.email!,
      role: this.form.value.role!,
    };
    this.dialogRef.close(result);
  }
}

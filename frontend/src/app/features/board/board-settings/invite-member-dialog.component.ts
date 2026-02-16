import { Component, inject, input, output, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';

export interface InviteMemberDialogData {
  boardId: string;
  boardName: string;
}

export interface InviteMemberDialogResult {
  email: string;
  role: 'viewer' | 'editor';
}

@Component({
  selector: 'app-board-invite-member-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    Dialog,
    InputTextModule,
    Select,
  ],
  template: `
    <p-dialog
      header="Invite Member"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '440px' }"
      [closable]="true"
      (onShow)="onDialogShow()"
    >
      <p class="text-gray-600 dark:text-gray-400 mb-4">
        Add a new member to "{{ boardName() }}"
      </p>
      <form [formGroup]="form" class="flex flex-col gap-4">
        <!-- Email -->
        <div class="flex flex-col gap-1">
          <label for="email" class="text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
          <input
            pInputText
            id="email"
            type="email"
            formControlName="email"
            placeholder="member@example.com"
            class="w-full"
          />
          @if (form.controls['email'].hasError('required') && form.controls['email'].touched) {
            <small class="text-red-500">Email is required</small>
          }
          @if (form.controls['email'].hasError('email') && form.controls['email'].touched) {
            <small class="text-red-500">Please enter a valid email</small>
          }
        </div>

        <!-- Role -->
        <div class="flex flex-col gap-1">
          <label for="role" class="text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
          <p-select
            formControlName="role"
            [options]="roleOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select a role"
            class="w-full"
          />
        </div>
      </form>

      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [text]="true"
            severity="secondary"
            (onClick)="onCancel()"
          />
          <p-button
            label="Send Invite"
            [disabled]="form.invalid"
            (onClick)="onInvite()"
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

  /** Input data */
  boardId = input<string>('');
  boardName = input<string>('');

  /** Output event */
  invited = output<InviteMemberDialogResult>();

  roleOptions = [
    { label: 'Viewer - Can view board and tasks', value: 'viewer' },
    { label: 'Editor - Can edit tasks and columns', value: 'editor' },
  ];

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['editor' as 'viewer' | 'editor', Validators.required],
  });

  onDialogShow(): void {
    this.form.reset({ email: '', role: 'editor' });
  }

  onCancel(): void {
    this.visible.set(false);
  }

  onInvite(): void {
    if (this.form.invalid) return;

    const result: InviteMemberDialogResult = {
      email: this.form.value.email!,
      role: this.form.value.role!,
    };
    this.visible.set(false);
    this.invited.emit(result);
  }
}

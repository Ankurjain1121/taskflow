import { Component, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { OnboardingService } from '../../../core/services/onboarding.service';

@Component({
  selector: 'app-step-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="text-center mb-8">
        <h2
          class="text-2xl font-bold text-[var(--card-foreground)] mb-2"
        >
          Create Your Workspace
        </h2>
        <p class="text-[var(--muted-foreground)]">
          This is where your team's boards and tasks will live.
        </p>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
        <div>
          <label
            for="name"
            class="block text-sm font-medium text-[var(--foreground)] mb-1"
          >
            Workspace Name <span class="text-[var(--destructive)]">*</span>
          </label>
          <input
            type="text"
            id="name"
            formControlName="name"
            placeholder="e.g., Marketing Team, Product Development"
            class="w-full px-4 py-3 border border-[var(--border)] rounded-lg
                   bg-[var(--card)] text-[var(--card-foreground)]
                   focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                   placeholder-[var(--muted-foreground)]"
          />
          @if (form.get('name')?.invalid && form.get('name')?.touched) {
            <p class="mt-1 text-sm text-[var(--destructive)]">Workspace name is required</p>
          }
        </div>

        <div>
          <label
            for="description"
            class="block text-sm font-medium text-[var(--foreground)] mb-1"
          >
            Description
            <span class="text-[var(--muted-foreground)]">(optional)</span>
          </label>
          <textarea
            id="description"
            formControlName="description"
            rows="3"
            placeholder="Briefly describe what this workspace is for..."
            class="w-full px-4 py-3 border border-[var(--border)] rounded-lg
                   bg-[var(--card)] text-[var(--card-foreground)]
                   focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                   placeholder-[var(--muted-foreground)] resize-none"
          ></textarea>
        </div>

        <div class="pt-4">
          <button
            type="submit"
            [disabled]="form.invalid || isLoading"
            class="w-full py-3 px-4 bg-[var(--primary)] hover:brightness-90 disabled:opacity-50
                   text-[var(--primary-foreground)] font-medium rounded-lg transition-colors
                   focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2
                   focus:ring-offset-[var(--card)]"
          >
            @if (isLoading) {
              <span class="flex items-center justify-center">
                <svg
                  class="animate-spin -ml-1 mr-2 h-4 w-4 text-[var(--primary-foreground)]"
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
                Creating...
              </span>
            } @else {
              Continue
            }
          </button>
        </div>
      </form>

      @if (error) {
        <div
          class="p-4 bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] rounded-lg"
        >
          <p class="text-sm text-[var(--destructive)]">{{ error }}</p>
        </div>
      }
    </div>
  `,
})
export class StepWorkspaceComponent {
  completed = output<string>();

  form: FormGroup;
  isLoading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private onboardingService: OnboardingService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.error = null;

    const { name, description } = this.form.value;

    this.onboardingService
      .createWorkspace(name, description || undefined)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.completed.emit(response.workspace_id);
        },
        error: (err) => {
          this.isLoading = false;
          this.error =
            err.error?.message ||
            'Failed to create workspace. Please try again.';
        },
      });
  }
}

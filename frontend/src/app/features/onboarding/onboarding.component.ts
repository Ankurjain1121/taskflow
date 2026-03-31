import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  OnboardingService,
  InvitationContext,
} from '../../core/services/onboarding.service';
import { AuthService } from '../../core/services/auth.service';
import { StepWorkspaceComponent } from './step-workspace/step-workspace.component';
import { StepInviteComponent } from './step-invite/step-invite.component';
import { StepWelcomeComponent } from './step-welcome/step-welcome.component';
import { StepUseCaseComponent } from './step-use-case/step-use-case.component';
import { StepPhoneComponent } from './step-phone/step-phone.component';

type OnboardingFlow = 'full' | 'abbreviated';

interface FullFlowStep {
  id: 'phone' | 'workspace' | 'invite' | 'use-case';
  label: string;
}

interface AbbreviatedFlowStep {
  id: 'phone' | 'welcome';
  label: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    StepWorkspaceComponent,
    StepInviteComponent,
    StepWelcomeComponent,
    StepUseCaseComponent,
    StepPhoneComponent,
  ],
  template: `
    <div
      class="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4"
    >
      <!-- Loading State -->
      @if (isLoading()) {
        <div class="flex flex-col items-center" role="status" aria-live="polite">
          <svg
            class="animate-spin h-8 w-8 text-[var(--primary)]"
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
          <p class="mt-4 text-[var(--muted-foreground)]">
            Loading...
          </p>
        </div>
      } @else {
        <!-- Logo / Header -->
        <div class="mb-8 text-center">
          <div
            class="w-12 h-12 bg-[var(--primary)] rounded-xl flex items-center justify-center mx-auto mb-3"
          >
            <svg
              class="w-7 h-7 text-[var(--primary-foreground)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              ></path>
            </svg>
          </div>
          <h1
            class="text-lg font-semibold text-[var(--card-foreground)]"
          >
            TaskBolt
          </h1>
        </div>

        <!-- Step Indicator -->
        <div class="flex items-center gap-2 mb-8">
          @for (step of currentSteps(); track step.id; let i = $index) {
            <div
              class="w-2.5 h-2.5 rounded-full transition-colors"
              [class.bg-[var(--primary)]]="i <= currentStepIndex()"
              [class.bg-[var(--border)]]="i > currentStepIndex()"
            ></div>
          }
        </div>

        <!-- Card Container -->
        <div
          class="w-full max-w-md bg-[var(--card)] rounded-2xl shadow-xl p-8"
        >
          <!-- Full Flow Steps -->
          @if (flow() === 'full') {
            @switch (currentFullStep()) {
              @case ('phone') {
                <app-step-phone (completed)="onPhoneComplete()" />
              }
              @case ('workspace') {
                <app-step-workspace (completed)="onWorkspaceCreated($event)" />
              }
              @case ('invite') {
                <app-step-invite
                  [workspaceId]="workspaceId()!"
                  (completed)="onInviteComplete()"
                />
              }
              @case ('use-case') {
                <app-step-use-case
                  (completed)="onUseCaseSelected($event)"
                  (skipped)="onUseCaseSkipped()"
                />
              }
            }
          }

          <!-- Abbreviated Flow Steps -->
          @if (flow() === 'abbreviated') {
            @switch (currentAbbreviatedStep()) {
              @case ('phone') {
                <app-step-phone (completed)="onPhoneComplete()" />
              }
              @case ('welcome') {
                <app-step-welcome
                  [workspaceName]="invitationContext()!.workspace_name"
                  [workspaceId]="invitationContext()!.workspace_id"
                  [boardIds]="invitationContext()!.board_ids"
                />
              }
            }
          }
        </div>

        <!-- Navigation Buttons -->
        @if (showBackButton()) {
          <button
            type="button"
            (click)="goBack()"
            aria-label="Go back to previous step"
            class="mt-6 text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]
                   flex items-center transition-colors"
          >
            <svg
              class="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              ></path>
            </svg>
            Back
          </button>
        }
      }
    </div>
  `,
})
export class OnboardingComponent implements OnInit {
  private authService = inject(AuthService);

  isLoading = signal(true);
  flow = signal<OnboardingFlow>('full');
  currentStepIndex = signal(0);
  workspaceId = signal<string | null>(null);
  invitationContext = signal<InvitationContext | null>(null);
  needsPhoneStep = signal(false);

  private fullFlowSteps = signal<FullFlowStep[]>([
    { id: 'workspace', label: 'Create Workspace' },
    { id: 'invite', label: 'Invite Team' },
    { id: 'use-case', label: 'Use Case' },
  ]);

  private abbreviatedFlowSteps = signal<AbbreviatedFlowStep[]>([
    { id: 'welcome', label: 'Welcome' },
  ]);

  currentSteps = computed(() => {
    return this.flow() === 'full'
      ? this.fullFlowSteps()
      : this.abbreviatedFlowSteps();
  });

  currentFullStep = computed(() => {
    return this.fullFlowSteps()[this.currentStepIndex()]?.id || 'workspace';
  });

  currentAbbreviatedStep = computed(() => {
    return this.abbreviatedFlowSteps()[this.currentStepIndex()]?.id || 'welcome';
  });

  showBackButton = computed(() => {
    // Show back button when not on the first step
    return this.currentStepIndex() > 0;
  });

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private onboardingService: OnboardingService,
  ) {}

  ngOnInit(): void {
    // Check if user has completed onboarding
    this.checkOnboardingStatus();
  }

  private checkOnboardingStatus(): void {
    this.http.get<{ onboarding_completed: boolean; user?: { phone_number?: string; phone_verified?: boolean } }>('/api/auth/me').subscribe({
      next: (response) => {
        if (response.onboarding_completed) {
          this.router.navigate(['/dashboard']);
          return;
        }

        // Check if user needs phone verification step
        const user = this.authService.currentUser();
        const needsPhone = !user?.phone_number || !user?.phone_verified;
        this.needsPhoneStep.set(needsPhone);

        // Check for invitation token
        const token = this.route.snapshot.queryParamMap.get('token');
        if (token) {
          this.initAbbreviatedFlow(token);
        } else {
          this.initFullFlow();
        }
      },
      error: () => {
        this.router.navigate(['/auth/sign-in']);
      },
    });
  }

  private initFullFlow(): void {
    if (this.needsPhoneStep()) {
      this.fullFlowSteps.set([
        { id: 'phone', label: 'Verify Phone' },
        { id: 'workspace', label: 'Create Workspace' },
        { id: 'invite', label: 'Invite Team' },
        { id: 'use-case', label: 'Use Case' },
      ]);
    }
    this.flow.set('full');
    this.currentStepIndex.set(0);
    this.isLoading.set(false);
  }

  private initAbbreviatedFlow(token: string): void {
    this.onboardingService.getInvitationContext(token).subscribe({
      next: (context) => {
        this.invitationContext.set(context);
        if (this.needsPhoneStep()) {
          this.abbreviatedFlowSteps.set([
            { id: 'phone', label: 'Verify Phone' },
            { id: 'welcome', label: 'Welcome' },
          ]);
        }
        this.flow.set('abbreviated');
        this.currentStepIndex.set(0);
        this.isLoading.set(false);
      },
      error: () => {
        this.initFullFlow();
      },
    });
  }

  onPhoneComplete(): void {
    this.currentStepIndex.update((i) => i + 1);
  }

  onWorkspaceCreated(workspaceId: string): void {
    this.workspaceId.set(workspaceId);
    this.currentStepIndex.set(1); // Move to invite step
  }

  onInviteComplete(): void {
    this.currentStepIndex.set(2); // Move to use-case step
  }

  onUseCaseSelected(_useCase: string): void {
    this.completeAndRedirect();
  }

  onUseCaseSkipped(): void {
    this.completeAndRedirect();
  }

  private completeAndRedirect(): void {
    this.onboardingService.completeOnboarding().subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        // Even if the API call fails, redirect to dashboard
        // The user can retry from there
        this.router.navigate(['/dashboard']);
      },
    });
  }

  goBack(): void {
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update((i) => i - 1);
    }
  }
}

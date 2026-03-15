import {
  Component,
  signal,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';

interface UseCase {
  id: string;
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-step-use-case',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="text-center mb-8">
        <h2
          class="text-2xl font-bold text-[var(--card-foreground)] dark:text-white mb-2"
        >
          What will you use TaskFlow for?
        </h2>
        <p class="text-[var(--muted-foreground)] dark:text-gray-400">
          We'll set up a sample board to get you started.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        @for (uc of useCases; track uc.id) {
          <button
            type="button"
            (click)="select(uc.id)"
            [class]="
              selectedUseCase() === uc.id
                ? 'p-5 border-2 rounded-xl text-left transition-all cursor-pointer border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'p-5 border-2 rounded-xl text-left transition-all cursor-pointer border-gray-200 dark:border-gray-600 hover:border-blue-400'
            "
          >
            <div class="text-3xl mb-3">{{ uc.icon }}</div>
            <h3
              class="font-semibold text-[var(--card-foreground)] dark:text-white"
            >
              {{ uc.title }}
            </h3>
            <p
              class="text-sm text-[var(--muted-foreground)] dark:text-gray-400 mt-1"
            >
              {{ uc.description }}
            </p>
          </button>
        }
      </div>

      <button
        type="button"
        (click)="onContinue()"
        [disabled]="!selectedUseCase()"
        class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed
               text-white font-medium rounded-lg transition-colors
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
               dark:focus:ring-offset-gray-900"
      >
        Continue
      </button>

      <div class="text-center">
        <button
          type="button"
          (click)="onSkip()"
          class="text-sm text-[var(--muted-foreground)] dark:text-gray-400
                 hover:text-[var(--card-foreground)] dark:hover:text-white transition-colors"
        >
          Skip -- I'll start from scratch
        </button>
      </div>
    </div>
  `,
})
export class StepUseCaseComponent {
  selectedUseCase = signal<string | null>(null);

  completed = output<string>();
  skipped = output<void>();

  useCases: UseCase[] = [
    {
      id: 'software',
      icon: '\uD83D\uDCBB',
      title: 'Software Development',
      description: 'Tasks, bugs, features, code reviews',
    },
    {
      id: 'marketing',
      icon: '\uD83D\uDCE3',
      title: 'Marketing & Content',
      description: 'Campaigns, content calendar, analytics',
    },
    {
      id: 'personal',
      icon: '\uD83D\uDC64',
      title: 'Personal Tasks',
      description: 'Habits, goals, errands, learning',
    },
    {
      id: 'design',
      icon: '\uD83C\uDFA8',
      title: 'Design & Creative',
      description: 'Wireframes, prototypes, design reviews',
    },
  ];

  select(id: string): void {
    this.selectedUseCase.set(id);
  }

  onContinue(): void {
    const value = this.selectedUseCase();
    if (value) {
      this.completed.emit(value);
    }
  }

  onSkip(): void {
    this.skipped.emit();
  }
}

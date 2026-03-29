import {
  Component,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  KeyboardShortcutsService,
  KeyboardShortcut,
} from '../../core/services/keyboard-shortcuts.service';
import { OnboardingChecklistService } from '../../core/services/onboarding-checklist.service';
import { FeatureHintsService } from '../../core/services/feature-hints.service';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

interface ShortcutGroup {
  category: string;
  shortcuts: KeyboardShortcut[];
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)]">
      <header
        class="bg-[var(--card)] shadow-sm border-b border-[var(--border)]"
      >
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <h1
            class="text-2xl font-bold text-[var(--card-foreground)] dark:text-white"
          >
            Help
          </h1>
          <p
            class="text-[var(--muted-foreground)] dark:text-gray-400 mt-1 text-sm"
          >
            Learn how to use TaskBolt effectively
          </p>
        </div>
      </header>

      <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <!-- Getting Started -->
        <section>
          <h2
            class="text-lg font-semibold text-[var(--card-foreground)] dark:text-white mb-4"
          >
            Getting Started
          </h2>
          <div
            class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 space-y-4"
          >
            <div class="flex gap-4">
              <div
                class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary"
              >
                1
              </div>
              <div>
                <h3
                  class="font-medium text-[var(--card-foreground)] dark:text-white"
                >
                  Create a Workspace
                </h3>
                <p
                  class="text-sm text-[var(--muted-foreground)] dark:text-gray-400 mt-1"
                >
                  Workspaces organize your projects. Start by creating one from
                  the sidebar.
                </p>
              </div>
            </div>
            <div class="flex gap-4">
              <div
                class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary"
              >
                2
              </div>
              <div>
                <h3
                  class="font-medium text-[var(--card-foreground)] dark:text-white"
                >
                  Add a Project
                </h3>
                <p
                  class="text-sm text-[var(--muted-foreground)] dark:text-gray-400 mt-1"
                >
                  Projects contain your tasks organized in columns. Use Kanban,
                  Scrum, or custom layouts.
                </p>
              </div>
            </div>
            <div class="flex gap-4">
              <div
                class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary"
              >
                3
              </div>
              <div>
                <h3
                  class="font-medium text-[var(--card-foreground)] dark:text-white"
                >
                  Create Tasks
                </h3>
                <p
                  class="text-sm text-[var(--muted-foreground)] dark:text-gray-400 mt-1"
                >
                  Add tasks to your project, set priorities, due dates, and assign
                  team members.
                </p>
              </div>
            </div>
            <div class="flex gap-4">
              <div
                class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary"
              >
                4
              </div>
              <div>
                <h3
                  class="font-medium text-[var(--card-foreground)] dark:text-white"
                >
                  Invite Your Team
                </h3>
                <p
                  class="text-sm text-[var(--muted-foreground)] dark:text-gray-400 mt-1"
                >
                  Go to Admin > Users to invite team members via email.
                </p>
              </div>
            </div>

            @if (!checklistService.shouldShow()) {
              <div class="pt-4 mt-4 border-t border-[var(--border)]">
                <button
                  (click)="restartChecklist()"
                  class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--primary)] border border-[var(--primary)]/40 rounded-lg hover:bg-[var(--primary)] hover:text-white transition-colors"
                >
                  <i class="pi pi-refresh text-xs" aria-hidden="true"></i>
                  Restart Getting Started Checklist
                </button>
              </div>
            }

            <div class="pt-4 mt-4 border-t border-[var(--border)]">
              <h3
                class="font-medium text-[var(--card-foreground)] dark:text-white mb-2"
              >
                Product Tour
              </h3>
              <p
                class="text-sm text-[var(--muted-foreground)] dark:text-gray-400 mb-3"
              >
                Replay the guided tour that highlights key features when you
                first open a project.
              </p>
              <button
                (click)="restartFeatureTour()"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--primary)] border border-[var(--primary)]/40 rounded-lg hover:bg-[var(--primary)] hover:text-white transition-colors"
              >
                <i class="pi pi-play text-xs" aria-hidden="true"></i>
                Restart Feature Tour
              </button>
            </div>
          </div>
        </section>

        <!-- Features Overview -->
        <section>
          <h2
            class="text-lg font-semibold text-[var(--card-foreground)] dark:text-white mb-4"
          >
            Features
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            @for (feature of features; track feature.title) {
              <div
                class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5"
              >
                <div class="flex items-start gap-3">
                  <span class="text-xl">{{ feature.icon }}</span>
                  <div>
                    <h3
                      class="font-medium text-[var(--card-foreground)] dark:text-white"
                    >
                      {{ feature.title }}
                    </h3>
                    <p
                      class="text-sm text-[var(--muted-foreground)] dark:text-gray-400 mt-1"
                    >
                      {{ feature.description }}
                    </p>
                  </div>
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Keyboard Shortcuts -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2
              class="text-lg font-semibold text-[var(--card-foreground)] dark:text-white"
            >
              Keyboard Shortcuts
            </h2>
            <button
              (click)="openShortcutModal()"
              class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--secondary)] text-[var(--foreground)] transition-colors"
            >
              <kbd
                class="text-xs font-mono px-1 py-0.5 bg-[var(--secondary)] border border-[var(--border)] rounded"
                >?</kbd
              >
              Open Reference
            </button>
          </div>
          @if (shortcutGroups().length === 0) {
            <div
              class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 text-sm text-[var(--muted-foreground)] dark:text-gray-400"
            >
              <p>
                Keyboard shortcuts are registered as you navigate the app. Open
                a project to see project-specific shortcuts here.
              </p>
              <p class="mt-2">
                Press
                <kbd
                  class="px-1.5 py-0.5 bg-[var(--secondary)] rounded text-xs font-mono"
                  >?</kbd
                >
                anywhere to see available shortcuts.
              </p>
            </div>
          } @else {
            <div class="space-y-6">
              @for (group of shortcutGroups(); track group.category) {
                <div
                  class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5"
                >
                  <h3
                    class="text-sm font-semibold text-[var(--muted-foreground)] dark:text-gray-400 uppercase tracking-wider mb-3"
                  >
                    {{ group.category }}
                  </h3>
                  <div class="space-y-2">
                    @for (
                      shortcut of group.shortcuts;
                      track shortcut.description
                    ) {
                      <div class="flex items-center justify-between py-1">
                        <span
                          class="text-sm text-[var(--foreground)] dark:text-gray-300"
                          >{{ shortcut.description }}</span
                        >
                        <kbd
                          class="px-2 py-1 bg-[var(--secondary)] rounded text-xs font-mono text-[var(--muted-foreground)] dark:text-gray-300 min-w-[2rem] text-center"
                        >
                          {{ formatShortcut(shortcut) }}
                        </kbd>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- FAQ -->
        <section>
          <h2
            class="text-lg font-semibold text-[var(--card-foreground)] dark:text-white mb-4"
          >
            FAQ
          </h2>
          <div
            class="bg-[var(--card)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]"
          >
            @for (faq of faqs; track faq.q) {
              <details class="p-5 group">
                <summary
                  class="font-medium text-[var(--card-foreground)] dark:text-white cursor-pointer list-none flex items-center justify-between"
                >
                  {{ faq.q }}
                  <svg
                    class="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <p
                  class="mt-3 text-sm text-[var(--muted-foreground)] dark:text-gray-400"
                >
                  {{ faq.a }}
                </p>
              </details>
            }
          </div>
        </section>

        <!-- Feedback -->
        <section class="pb-8">
          <h2
            class="text-lg font-semibold text-[var(--card-foreground)] dark:text-white mb-4"
          >
            Feedback
          </h2>
          <div
            class="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 text-center"
          >
            <p
              class="text-sm text-[var(--muted-foreground)] dark:text-gray-400 mb-4"
            >
              Have a suggestion or found an issue? We'd love to hear from you.
            </p>
            <a
              href="mailto:support@paraslace.in"
              class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary hover:brightness-90 transition-all font-medium text-sm"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Send Feedback
            </a>
          </div>
        </section>
      </main>
    </div>
  `,
})
export class HelpComponent implements OnInit {
  private shortcutsService = inject(KeyboardShortcutsService);
  readonly checklistService = inject(OnboardingChecklistService);
  private featureHintsService = inject(FeatureHintsService);
  private router = inject(Router);
  private wsContext = inject(WorkspaceContextService);

  shortcutGroups = signal<ShortcutGroup[]>([]);

  readonly features = [
    {
      icon: '\u{1F4CB}',
      title: 'Kanban Boards',
      description:
        'Drag-and-drop task management with customizable columns and status mappings.',
    },
    {
      icon: '\u{1F4CA}',
      title: 'Reports & Analytics',
      description:
        'Track progress with burndown charts, velocity reports, and workload analysis.',
    },
    {
      icon: '\u{1F4C5}',
      title: 'Calendar View',
      description: 'See tasks on a timeline with due dates and milestones.',
    },
    {
      icon: '\u{1F504}',
      title: 'Recurring Tasks',
      description:
        'Automate repetitive work with daily, weekly, or custom recurrence patterns.',
    },
    {
      icon: '\u{23F1}\u{FE0F}',
      title: 'Time Tracking',
      description:
        'Log time on tasks with start/stop timers or manual entries.',
    },
    {
      icon: '\u{1F517}',
      title: 'Dependencies',
      description:
        'Link tasks with blocking/blocked-by relationships and visualize on Gantt charts.',
    },
    {
      icon: '\u{26A1}',
      title: 'Workflow Automation',
      description:
        'Set up rules to auto-assign, move, or notify based on triggers.',
    },
    {
      icon: '\u{1F310}',
      title: 'Client Portal',
      description:
        'Share projects with external clients via secure read-only links.',
    },
  ];

  readonly faqs = [
    {
      q: 'How do I delete a task?',
      a: 'Open the task and click the delete button, or right-click on a task card. Deleted tasks go to the Archive and are permanently removed after 30 days.',
    },
    {
      q: 'Can I import tasks from other tools?',
      a: 'Yes! Go to any project settings and use the Import/Export feature. We support CSV and JSON formats.',
    },
    {
      q: 'How do I set up notifications?',
      a: 'Go to Settings > Notifications to configure email and in-app notification preferences for different event types.',
    },
    {
      q: 'What are project templates?',
      a: 'Project templates let you create new projects with pre-defined columns and settings. Go to Project Templates from the sidebar to browse or create templates.',
    },
    {
      q: 'How do webhooks work?',
      a: 'Webhooks send HTTP POST requests to your URL when events happen (task created, moved, etc). Configure them from Admin > Webhooks.',
    },
  ];

  ngOnInit(): void {
    this.refreshShortcuts();
  }

  refreshShortcuts(): void {
    const grouped = this.shortcutsService.getByCategory();
    const groups: ShortcutGroup[] = [];
    grouped.forEach((shortcuts, category) => {
      groups.push({ category, shortcuts });
    });
    this.shortcutGroups.set(groups);
  }

  openShortcutModal(): void {
    this.shortcutsService.helpRequested.update((n) => n + 1);
  }

  formatShortcut(shortcut: KeyboardShortcut): string {
    return this.shortcutsService.formatShortcut(shortcut);
  }

  restartChecklist(): void {
    this.checklistService.resetChecklist();
    this.navigateToDashboard();
  }

  restartFeatureTour(): void {
    this.featureHintsService.resetAll();
    this.navigateToDashboard();
  }

  private navigateToDashboard(): void {
    const wsId = this.wsContext.activeWorkspaceId();
    if (wsId) {
      this.router.navigate(['/workspace', wsId, 'dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}

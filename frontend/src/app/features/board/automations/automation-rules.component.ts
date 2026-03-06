import {
  Component,
  input,
  signal,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AutomationService,
  AutomationRuleWithActions,
  AutomationLog,
  AutomationTrigger,
  AutomationActionType,
} from '../../../core/services/automation.service';
import { RuleBuilderComponent } from './rule-builder.component';

@Component({
  selector: 'app-automation-rules',
  standalone: true,
  imports: [CommonModule, FormsModule, RuleBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-[var(--card-foreground)]">
          Automation Rules
        </h3>
        <button
          (click)="showBuilder.set(true)"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Rule
        </button>
      </div>

      <!-- Rule Builder (inline) -->
      @if (showBuilder()) {
        <app-rule-builder
          [projectId]="projectId()"
          [editingRule]="editingRule()"
          (saved)="onRuleSaved($event)"
          (cancelled)="onBuilderCancelled()"
        />
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-8">
          <svg
            class="animate-spin h-6 w-6 text-primary"
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
        </div>
      } @else if (rules().length === 0 && !showBuilder()) {
        <!-- Empty State -->
        <div class="bg-[var(--secondary)] rounded-lg p-6 text-center">
          <svg
            class="w-10 h-10 text-gray-400 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <p class="text-sm text-[var(--muted-foreground)]">
            No automation rules yet. Create one to automate your workflow.
          </p>
        </div>
      } @else {
        <!-- Rules List -->
        <div class="space-y-3">
          @for (rwa of rules(); track rwa.rule.id) {
            <div
              class="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <!-- Rule Header -->
              <div class="p-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 min-w-0">
                    <!-- Trigger Icon -->
                    <div
                      class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                      [class]="getTriggerBgClass(rwa.rule.trigger)"
                    >
                      <svg
                        class="w-4.5 h-4.5"
                        [class]="getTriggerIconClass(rwa.rule.trigger)"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="text-sm font-medium text-[var(--card-foreground)] truncate"
                          >{{ rwa.rule.name }}</span
                        >
                        @if (!rwa.rule.is_active) {
                          <span
                            class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]"
                          >
                            Inactive
                          </span>
                        }
                      </div>
                      <div class="flex items-center gap-2 mt-0.5">
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                        >
                          {{ getTriggerLabel(rwa.rule.trigger) }}
                        </span>
                        <span class="text-xs text-gray-400">
                          {{ rwa.actions.length }} action{{
                            rwa.actions.length !== 1 ? 's' : ''
                          }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <!-- Active Toggle -->
                    <button
                      (click)="toggleActive(rwa)"
                      class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                      [class.bg-primary]="rwa.rule.is_active"
                      [class.bg-[var(--secondary)]]="!rwa.rule.is_active"
                      [title]="rwa.rule.is_active ? 'Disable' : 'Enable'"
                    >
                      <span
                        class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                        [class.translate-x-4]="rwa.rule.is_active"
                        [class.translate-x-0]="!rwa.rule.is_active"
                      ></span>
                    </button>
                    <!-- Expand Logs -->
                    <button
                      (click)="toggleLogs(rwa.rule.id)"
                      class="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                      title="View Logs"
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
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    </button>
                    <!-- Edit -->
                    <button
                      (click)="editRule(rwa)"
                      class="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                      title="Edit"
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
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <!-- Delete -->
                    <button
                      (click)="confirmDelete(rwa)"
                      class="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      title="Delete"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Action Chips -->
                @if (rwa.actions.length > 0) {
                  <div class="flex flex-wrap gap-1.5 mt-3">
                    @for (action of rwa.actions; track action.id) {
                      <span
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)] text-[var(--foreground)]"
                      >
                        <svg
                          class="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                        {{ getActionLabel(action.action_type) }}
                      </span>
                    }
                  </div>
                }
              </div>

              <!-- Logs Section (expandable) -->
              @if (expandedLogRuleId() === rwa.rule.id) {
                <div
                  class="border-t border-[var(--border)] bg-[var(--secondary)] p-4"
                >
                  <h4
                    class="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2"
                  >
                    Recent Logs
                  </h4>
                  @if (logsLoading()) {
                    <div class="flex items-center justify-center py-4">
                      <svg
                        class="animate-spin h-4 w-4 text-gray-400"
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
                    </div>
                  } @else if (logs().length === 0) {
                    <p class="text-xs text-gray-400 text-center py-2">
                      No executions yet.
                    </p>
                  } @else {
                    <div class="space-y-1.5">
                      @for (log of logs(); track log.id) {
                        <div class="flex items-center justify-between text-xs">
                          <div class="flex items-center gap-2">
                            <span
                              class="w-1.5 h-1.5 rounded-full"
                              [class.bg-green-500]="log.status === 'success'"
                              [class.bg-red-500]="log.status === 'error'"
                              [class.bg-yellow-500]="
                                log.status !== 'success' &&
                                log.status !== 'error'
                              "
                            ></span>
                            <span class="text-[var(--muted-foreground)]">{{
                              log.status
                            }}</span>
                          </div>
                          <span class="text-gray-400">{{
                            log.triggered_at | date: 'short'
                          }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AutomationRulesComponent implements OnInit, OnChanges {
  private automationService = inject(AutomationService);

  projectId = input.required<string>();

  rules = signal<AutomationRuleWithActions[]>([]);
  loading = signal(true);
  showBuilder = signal(false);
  editingRule = signal<AutomationRuleWithActions | null>(null);
  expandedLogRuleId = signal<string | null>(null);
  logs = signal<AutomationLog[]>([]);
  logsLoading = signal(false);

  private triggerLabels: Record<AutomationTrigger, string> = {
    task_moved: 'Task Moved',
    task_created: 'Task Created',
    task_assigned: 'Task Assigned',
    task_priority_changed: 'Priority Changed',
    task_due_date_passed: 'Due Date Passed',
    task_completed: 'Task Completed',
    subtask_completed: 'Subtask Completed',
    comment_added: 'Comment Added',
    custom_field_changed: 'Custom Field Changed',
    label_changed: 'Label Changed',
    due_date_approaching: 'Due Date Approaching',
    member_joined: 'Member Joined',
  };

  private actionLabels: Record<AutomationActionType, string> = {
    move_task: 'Move Task',
    assign_task: 'Assign Task',
    set_priority: 'Set Priority',
    send_notification: 'Send Notification',
    add_label: 'Add Label',
    set_milestone: 'Set Milestone',
    create_subtask: 'Create Subtask',
    add_comment: 'Add Comment',
    set_due_date: 'Set Due Date',
    set_custom_field: 'Set Custom Field',
    send_webhook: 'Send Webhook',
    assign_to_role_members: 'Assign to Role Members',
  };

  ngOnInit(): void {
    this.loadRules();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['projectId'] && !changes['projectId'].firstChange) {
      this.loadRules();
    }
  }

  getTriggerLabel(trigger: AutomationTrigger): string {
    return this.triggerLabels[trigger] || trigger;
  }

  getActionLabel(actionType: AutomationActionType): string {
    return this.actionLabels[actionType] || actionType;
  }

  getTriggerBgClass(trigger: AutomationTrigger): string {
    const map: Record<AutomationTrigger, string> = {
      task_moved: 'bg-purple-100',
      task_created: 'bg-green-100',
      task_assigned: 'bg-blue-100',
      task_priority_changed: 'bg-orange-100',
      task_due_date_passed: 'bg-red-100',
      task_completed: 'bg-emerald-100',
      subtask_completed: 'bg-teal-100',
      comment_added: 'bg-cyan-100',
      custom_field_changed: 'bg-indigo-100',
      label_changed: 'bg-yellow-100',
      due_date_approaching: 'bg-amber-100',
      member_joined: 'bg-pink-100',
    };
    return map[trigger] || 'bg-gray-100';
  }

  getTriggerIconClass(trigger: AutomationTrigger): string {
    const map: Record<AutomationTrigger, string> = {
      task_moved: 'text-purple-600',
      task_created: 'text-green-600',
      task_assigned: 'text-blue-600',
      task_priority_changed: 'text-orange-600',
      task_due_date_passed: 'text-red-600',
      task_completed: 'text-emerald-600',
      subtask_completed: 'text-teal-600',
      comment_added: 'text-cyan-600',
      custom_field_changed: 'text-indigo-600',
      label_changed: 'text-yellow-600',
      due_date_approaching: 'text-amber-600',
      member_joined: 'text-pink-600',
    };
    return map[trigger] || 'text-gray-600';
  }

  toggleActive(rwa: AutomationRuleWithActions): void {
    const newActive = !rwa.rule.is_active;
    this.automationService
      .updateRule(rwa.rule.id, { is_active: newActive })
      .subscribe({
        next: (updated) => {
          this.rules.update((rules) =>
            rules.map((r) => (r.rule.id === updated.rule.id ? updated : r)),
          );
        },
        error: (err) => console.error('Failed to toggle automation rule:', err),
      });
  }

  toggleLogs(ruleId: string): void {
    if (this.expandedLogRuleId() === ruleId) {
      this.expandedLogRuleId.set(null);
      this.logs.set([]);
      return;
    }

    this.expandedLogRuleId.set(ruleId);
    this.logsLoading.set(true);
    this.automationService.getRuleLogs(ruleId, 10).subscribe({
      next: (logs) => {
        this.logs.set(logs);
        this.logsLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load automation logs:', err);
        this.logsLoading.set(false);
      },
    });
  }

  editRule(rwa: AutomationRuleWithActions): void {
    this.editingRule.set(rwa);
    this.showBuilder.set(true);
  }

  confirmDelete(rwa: AutomationRuleWithActions): void {
    if (
      !confirm(
        `Delete automation rule "${rwa.rule.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    this.automationService.deleteRule(rwa.rule.id).subscribe({
      next: () => {
        this.rules.update((rules) =>
          rules.filter((r) => r.rule.id !== rwa.rule.id),
        );
      },
      error: (err) => console.error('Failed to delete automation rule:', err),
    });
  }

  onRuleSaved(saved: AutomationRuleWithActions): void {
    const existing = this.rules().find((r) => r.rule.id === saved.rule.id);
    if (existing) {
      this.rules.update((rules) =>
        rules.map((r) => (r.rule.id === saved.rule.id ? saved : r)),
      );
    } else {
      this.rules.update((rules) => [saved, ...rules]);
    }
    this.showBuilder.set(false);
    this.editingRule.set(null);
  }

  onBuilderCancelled(): void {
    this.showBuilder.set(false);
    this.editingRule.set(null);
  }

  private loadRules(): void {
    this.loading.set(true);
    this.automationService.listRules(this.projectId()).subscribe({
      next: (rules) => {
        this.rules.set(rules);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load automation rules:', err);
        this.loading.set(false);
      },
    });
  }
}

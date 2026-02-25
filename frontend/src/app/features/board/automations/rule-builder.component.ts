import {
  Component,
  input,
  output,
  signal,
  inject,
  computed,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AutomationService,
  AutomationRuleWithActions,
  AutomationTrigger,
  AutomationActionType,
  CreateRuleRequest,
  CreateActionRequest,
  UpdateRuleRequest,
} from '../../../core/services/automation.service';

interface TriggerOption {
  value: AutomationTrigger;
  label: string;
  description: string;
}

interface ActionOption {
  value: AutomationActionType;
  label: string;
  description: string;
}

interface ActionFormItem {
  id: string;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
}

@Component({
  selector: 'app-rule-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bg-[var(--card)] border border-primary/30 rounded-lg shadow-sm overflow-hidden"
    >
      <!-- Header -->
      <div class="bg-primary/10 px-4 py-3 border-b border-primary/15">
        <h4 class="text-sm font-semibold text-primary">
          {{
            editingRule() ? 'Edit Automation Rule' : 'Create Automation Rule'
          }}
        </h4>
      </div>

      <div class="p-4 space-y-5">
        <!-- Step 1: Name + Trigger -->
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span
              class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center"
              >1</span
            >
            <span class="text-sm font-medium text-[var(--foreground)]"
              >Name & Trigger</span
            >
          </div>

          <input
            type="text"
            [(ngModel)]="ruleName"
            placeholder="Rule name (e.g., Auto-assign on create)"
            class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
          />

          <div>
            <label
              class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
              >When this happens...</label
            >
            <select
              [(ngModel)]="selectedTrigger"
              (ngModelChange)="onTriggerChange()"
              class="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
            >
              @for (opt of triggerOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
            <p class="mt-1 text-xs text-gray-400">
              {{ getSelectedTriggerDescription() }}
            </p>
          </div>
        </div>

        <!-- Step 2: Trigger Config -->
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span
              class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center"
              >2</span
            >
            <span class="text-sm font-medium text-[var(--foreground)]"
              >Trigger Conditions</span
            >
          </div>

          <div class="bg-[var(--secondary)] rounded-md p-3 space-y-2">
            @switch (selectedTrigger) {
              @case ('task_moved') {
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                      >From Column (optional)</label
                    >
                    <input
                      type="text"
                      [(ngModel)]="triggerConfigFromColumn"
                      placeholder="Any column"
                      class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label
                      class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                      >To Column (optional)</label
                    >
                    <input
                      type="text"
                      [(ngModel)]="triggerConfigToColumn"
                      placeholder="Any column"
                      class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              }
              @case ('task_priority_changed') {
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                      >From Priority (optional)</label
                    >
                    <select
                      [(ngModel)]="triggerConfigFromPriority"
                      class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Any priority</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label
                      class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                      >To Priority (optional)</label
                    >
                    <select
                      [(ngModel)]="triggerConfigToPriority"
                      class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Any priority</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              }
              @case ('task_assigned') {
                <div>
                  <label
                    class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                    >Assigned To (User ID, optional)</label
                  >
                  <input
                    type="text"
                    [(ngModel)]="triggerConfigAssignee"
                    placeholder="Any user"
                    class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                  />
                </div>
              }
              @case ('due_date_approaching') {
                <div>
                  <label
                    class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                    >Days Before Due Date</label
                  >
                  <input
                    type="number"
                    [(ngModel)]="triggerConfigDaysBefore"
                    placeholder="1"
                    min="1"
                    class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                  />
                </div>
              }
              @case ('label_changed') {
                <div>
                  <label
                    class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                    >Label Name (optional filter)</label
                  >
                  <input
                    type="text"
                    [(ngModel)]="triggerConfigLabelName"
                    placeholder="Any label"
                    class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                  />
                </div>
              }
              @case ('custom_field_changed') {
                <div>
                  <label
                    class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                    >Field Name (optional filter)</label
                  >
                  <input
                    type="text"
                    [(ngModel)]="triggerConfigFieldName"
                    placeholder="Any field"
                    class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                  />
                </div>
              }
              @default {
                <p class="text-xs text-gray-400">
                  No additional configuration needed for this trigger.
                </p>
              }
            }
          </div>
        </div>

        <!-- Step 3: Actions -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span
                class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center"
                >3</span
              >
              <span class="text-sm font-medium text-[var(--foreground)]"
                >Actions</span
              >
            </div>
            <button
              (click)="addAction()"
              class="text-xs text-primary hover:text-primary font-medium"
            >
              + Add Action
            </button>
          </div>

          @if (actions().length === 0) {
            <div class="bg-[var(--secondary)] rounded-md p-3 text-center">
              <p class="text-xs text-gray-400">
                Add at least one action to define what happens.
              </p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (action of actions(); track action.id; let i = $index) {
                <div class="bg-[var(--secondary)] rounded-md p-3 relative">
                  <!-- Remove button -->
                  <button
                    (click)="removeAction(i)"
                    class="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors"
                    title="Remove action"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>

                  <div class="space-y-2">
                    <div>
                      <label
                        class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                        >Action {{ i + 1 }}</label
                      >
                      <select
                        [ngModel]="action.action_type"
                        (ngModelChange)="updateActionType(i, $event)"
                        class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                      >
                        @for (opt of actionOptions; track opt.value) {
                          <option [value]="opt.value">{{ opt.label }}</option>
                        }
                      </select>
                      <p class="mt-0.5 text-xs text-gray-400">
                        {{ getActionDescription(action.action_type) }}
                      </p>
                    </div>

                    <!-- Action-specific config -->
                    @switch (action.action_type) {
                      @case ('move_task') {
                        <div>
                          <label
                            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                            >Target Column Name</label
                          >
                          <input
                            type="text"
                            [ngModel]="
                              action.action_config['target_column'] || ''
                            "
                            (ngModelChange)="
                              updateActionConfig(i, 'target_column', $event)
                            "
                            placeholder="e.g., Done, In Review"
                            class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      }
                      @case ('assign_task') {
                        <div>
                          <label
                            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                            >Assign To (User ID)</label
                          >
                          <input
                            type="text"
                            [ngModel]="
                              action.action_config['assignee_id'] || ''
                            "
                            (ngModelChange)="
                              updateActionConfig(i, 'assignee_id', $event)
                            "
                            placeholder="User ID"
                            class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      }
                      @case ('set_priority') {
                        <div>
                          <label
                            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                            >Priority</label
                          >
                          <select
                            [ngModel]="action.action_config['priority'] || ''"
                            (ngModelChange)="
                              updateActionConfig(i, 'priority', $event)
                            "
                            class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      }
                      @case ('send_notification') {
                        <div>
                          <label
                            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                            >Notification Message</label
                          >
                          <input
                            type="text"
                            [ngModel]="action.action_config['message'] || ''"
                            (ngModelChange)="
                              updateActionConfig(i, 'message', $event)
                            "
                            placeholder="Notification message..."
                            class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      }
                      @case ('add_label') {
                        <div>
                          <label
                            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                            >Label Name</label
                          >
                          <input
                            type="text"
                            [ngModel]="action.action_config['label'] || ''"
                            (ngModelChange)="
                              updateActionConfig(i, 'label', $event)
                            "
                            placeholder="e.g., urgent, reviewed"
                            class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      }
                      @case ('set_milestone') {
                        <div>
                          <label
                            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                            >Milestone ID</label
                          >
                          <input
                            type="text"
                            [ngModel]="
                              action.action_config['milestone_id'] || ''
                            "
                            (ngModelChange)="
                              updateActionConfig(i, 'milestone_id', $event)
                            "
                            placeholder="Milestone ID"
                            class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      }
                      @case ('create_subtask') {
                        <div>
                          <label
                            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                            >Subtask Title</label
                          >
                          <input
                            type="text"
                            [ngModel]="
                              action.action_config['subtask_title'] || ''
                            "
                            (ngModelChange)="
                              updateActionConfig(i, 'subtask_title', $event)
                            "
                            placeholder="e.g., Review code changes"
                            class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      }
                      @case ('add_comment') {
                        <div>
                          <label
                            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                            >Comment Text</label
                          >
                          <textarea
                            [ngModel]="
                              action.action_config['comment_text'] || ''
                            "
                            (ngModelChange)="
                              updateActionConfig(i, 'comment_text', $event)
                            "
                            placeholder="Comment to add..."
                            rows="2"
                            class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                          ></textarea>
                        </div>
                      }
                      @case ('set_due_date') {
                        <div>
                          <label
                            class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                            >Days From Now</label
                          >
                          <input
                            type="number"
                            [ngModel]="
                              action.action_config['days_from_now'] || ''
                            "
                            (ngModelChange)="
                              updateActionConfig(i, 'days_from_now', $event)
                            "
                            placeholder="e.g., 7"
                            min="0"
                            class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      }
                      @case ('set_custom_field') {
                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label
                              class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                              >Field Name</label
                            >
                            <input
                              type="text"
                              [ngModel]="
                                action.action_config['field_name'] || ''
                              "
                              (ngModelChange)="
                                updateActionConfig(i, 'field_name', $event)
                              "
                              placeholder="Field name"
                              class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label
                              class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                              >Field Value</label
                            >
                            <input
                              type="text"
                              [ngModel]="
                                action.action_config['field_value'] || ''
                              "
                              (ngModelChange)="
                                updateActionConfig(i, 'field_value', $event)
                              "
                              placeholder="Value"
                              class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                            />
                          </div>
                        </div>
                      }
                      @case ('send_webhook') {
                        <div class="space-y-2">
                          <div>
                            <label
                              class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                              >Webhook URL</label
                            >
                            <input
                              type="text"
                              [ngModel]="
                                action.action_config['webhook_url'] || ''
                              "
                              (ngModelChange)="
                                updateActionConfig(i, 'webhook_url', $event)
                              "
                              placeholder="https://example.com/webhook"
                              class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label
                              class="block text-xs font-medium text-[var(--muted-foreground)] mb-1"
                              >HTTP Method</label
                            >
                            <select
                              [ngModel]="
                                action.action_config['method'] || 'POST'
                              "
                              (ngModelChange)="
                                updateActionConfig(i, 'method', $event)
                              "
                              class="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md focus:border-primary focus:ring-1 focus:ring-ring"
                            >
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                            </select>
                          </div>
                        </div>
                      }
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Buttons -->
        <div
          class="flex justify-end gap-2 pt-2 border-t border-[var(--border)]"
        >
          <button
            (click)="cancel()"
            class="px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            (click)="save()"
            [disabled]="!canSave()"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary hover:brightness-90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ editingRule() ? 'Update Rule' : 'Create Rule' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class RuleBuilderComponent implements OnInit, OnChanges {
  private automationService = inject(AutomationService);

  boardId = input.required<string>();
  editingRule = input<AutomationRuleWithActions | null>(null);

  saved = output<AutomationRuleWithActions>();
  cancelled = output<void>();

  // Form state
  ruleName = '';
  selectedTrigger: AutomationTrigger = 'task_moved';
  actions = signal<ActionFormItem[]>([]);

  // Trigger config fields
  triggerConfigFromColumn = '';
  triggerConfigToColumn = '';
  triggerConfigFromPriority = '';
  triggerConfigToPriority = '';
  triggerConfigAssignee = '';
  triggerConfigDaysBefore = '';
  triggerConfigLabelName = '';
  triggerConfigFieldName = '';

  saving = signal(false);

  triggerOptions: TriggerOption[] = [
    {
      value: 'task_moved',
      label: 'Task Moved',
      description: 'Fires when a task is moved between columns.',
    },
    {
      value: 'task_created',
      label: 'Task Created',
      description: 'Fires when a new task is created on the board.',
    },
    {
      value: 'task_assigned',
      label: 'Task Assigned',
      description: 'Fires when a task is assigned to a user.',
    },
    {
      value: 'task_priority_changed',
      label: 'Priority Changed',
      description: 'Fires when a task priority is changed.',
    },
    {
      value: 'task_due_date_passed',
      label: 'Due Date Passed',
      description: 'Fires when a task due date has passed.',
    },
    {
      value: 'task_completed',
      label: 'Task Completed',
      description: 'Fires when a task is marked as completed.',
    },
    {
      value: 'subtask_completed',
      label: 'Subtask Completed',
      description: 'Fires when a subtask is marked complete.',
    },
    {
      value: 'comment_added',
      label: 'Comment Added',
      description: 'Fires when a comment is added to a task.',
    },
    {
      value: 'custom_field_changed',
      label: 'Custom Field Changed',
      description: 'Fires when a custom field value changes.',
    },
    {
      value: 'label_changed',
      label: 'Label Changed',
      description: 'Fires when labels are added or removed.',
    },
    {
      value: 'due_date_approaching',
      label: 'Due Date Approaching',
      description: 'Fires when a task due date is approaching.',
    },
  ];

  actionOptions: ActionOption[] = [
    {
      value: 'move_task',
      label: 'Move Task',
      description: 'Move the task to a specific column.',
    },
    {
      value: 'assign_task',
      label: 'Assign Task',
      description: 'Assign the task to a specific user.',
    },
    {
      value: 'set_priority',
      label: 'Set Priority',
      description: 'Change the task priority level.',
    },
    {
      value: 'send_notification',
      label: 'Send Notification',
      description: 'Send a notification to relevant users.',
    },
    {
      value: 'add_label',
      label: 'Add Label',
      description: 'Add a label to the task.',
    },
    {
      value: 'set_milestone',
      label: 'Set Milestone',
      description: 'Assign the task to a milestone.',
    },
    {
      value: 'create_subtask',
      label: 'Create Subtask',
      description: 'Create a subtask on the task.',
    },
    {
      value: 'add_comment',
      label: 'Add Comment',
      description: 'Add a comment to the task.',
    },
    {
      value: 'set_due_date',
      label: 'Set Due Date',
      description: 'Set the task due date relative to now.',
    },
    {
      value: 'set_custom_field',
      label: 'Set Custom Field',
      description: 'Set a custom field value on the task.',
    },
    {
      value: 'send_webhook',
      label: 'Send Webhook',
      description: 'Send an HTTP webhook to a URL.',
    },
  ];

  canSave = computed(() => {
    return (
      this.ruleName.trim().length > 0 &&
      this.actions().length > 0 &&
      !this.saving()
    );
  });

  ngOnInit(): void {
    this.populateFromEditingRule();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingRule']) {
      this.populateFromEditingRule();
    }
  }

  getSelectedTriggerDescription(): string {
    const opt = this.triggerOptions.find(
      (t) => t.value === this.selectedTrigger,
    );
    return opt?.description || '';
  }

  getActionDescription(actionType: AutomationActionType): string {
    const opt = this.actionOptions.find((a) => a.value === actionType);
    return opt?.description || '';
  }

  onTriggerChange(): void {
    // Reset trigger config when trigger changes
    this.triggerConfigFromColumn = '';
    this.triggerConfigToColumn = '';
    this.triggerConfigFromPriority = '';
    this.triggerConfigToPriority = '';
    this.triggerConfigAssignee = '';
    this.triggerConfigDaysBefore = '';
    this.triggerConfigLabelName = '';
    this.triggerConfigFieldName = '';
  }

  addAction(): void {
    this.actions.update((actions) => [
      ...actions,
      {
        id: crypto.randomUUID(),
        action_type: 'move_task' as AutomationActionType,
        action_config: {},
      },
    ]);
  }

  removeAction(index: number): void {
    this.actions.update((actions) => actions.filter((_, i) => i !== index));
  }

  updateActionType(index: number, newType: AutomationActionType): void {
    this.actions.update((actions) =>
      actions.map((a, i) =>
        i === index ? { ...a, action_type: newType, action_config: {} } : a,
      ),
    );
  }

  updateActionConfig(index: number, key: string, value: string): void {
    this.actions.update((actions) =>
      actions.map((a, i) =>
        i === index
          ? { ...a, action_config: { ...a.action_config, [key]: value } }
          : a,
      ),
    );
  }

  cancel(): void {
    this.resetForm();
    this.cancelled.emit();
  }

  save(): void {
    if (!this.canSave()) return;

    this.saving.set(true);
    const triggerConfig = this.buildTriggerConfig();
    const actionRequests: CreateActionRequest[] = this.actions().map((a) => ({
      action_type: a.action_type,
      action_config: a.action_config,
    }));

    const editing = this.editingRule();
    if (editing) {
      const req: UpdateRuleRequest = {
        name: this.ruleName.trim(),
        trigger: this.selectedTrigger,
        trigger_config: triggerConfig,
        actions: actionRequests,
      };

      this.automationService.updateRule(editing.rule.id, req).subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.resetForm();
          this.saved.emit(updated);
        },
        error: (err) => {
          this.saving.set(false);
        },
      });
    } else {
      const req: CreateRuleRequest = {
        name: this.ruleName.trim(),
        trigger: this.selectedTrigger,
        trigger_config: triggerConfig,
        actions: actionRequests,
      };

      this.automationService.createRule(this.boardId(), req).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.resetForm();
          this.saved.emit(created);
        },
        error: (err) => {
          this.saving.set(false);
        },
      });
    }
  }

  private buildTriggerConfig(): Record<string, unknown> {
    switch (this.selectedTrigger) {
      case 'task_moved': {
        const config: Record<string, unknown> = {};
        if (this.triggerConfigFromColumn.trim())
          config['from_column'] = this.triggerConfigFromColumn.trim();
        if (this.triggerConfigToColumn.trim())
          config['to_column'] = this.triggerConfigToColumn.trim();
        return config;
      }
      case 'task_priority_changed': {
        const config: Record<string, unknown> = {};
        if (this.triggerConfigFromPriority)
          config['from_priority'] = this.triggerConfigFromPriority;
        if (this.triggerConfigToPriority)
          config['to_priority'] = this.triggerConfigToPriority;
        return config;
      }
      case 'task_assigned': {
        const config: Record<string, unknown> = {};
        if (this.triggerConfigAssignee.trim())
          config['assignee_id'] = this.triggerConfigAssignee.trim();
        return config;
      }
      case 'due_date_approaching': {
        const config: Record<string, unknown> = {};
        if (this.triggerConfigDaysBefore.toString().trim())
          config['days_before'] =
            parseInt(this.triggerConfigDaysBefore.toString(), 10) || 1;
        return config;
      }
      case 'label_changed': {
        const config: Record<string, unknown> = {};
        if (this.triggerConfigLabelName.trim())
          config['label_name'] = this.triggerConfigLabelName.trim();
        return config;
      }
      case 'custom_field_changed': {
        const config: Record<string, unknown> = {};
        if (this.triggerConfigFieldName.trim())
          config['field_name'] = this.triggerConfigFieldName.trim();
        return config;
      }
      default:
        return {};
    }
  }

  private populateFromEditingRule(): void {
    const editing = this.editingRule();
    if (!editing) {
      this.resetForm();
      return;
    }

    this.ruleName = editing.rule.name;
    this.selectedTrigger = editing.rule.trigger;

    // Populate trigger config
    const tc = editing.rule.trigger_config || {};
    this.triggerConfigFromColumn = (tc['from_column'] as string) || '';
    this.triggerConfigToColumn = (tc['to_column'] as string) || '';
    this.triggerConfigFromPriority = (tc['from_priority'] as string) || '';
    this.triggerConfigToPriority = (tc['to_priority'] as string) || '';
    this.triggerConfigAssignee = (tc['assignee_id'] as string) || '';
    this.triggerConfigDaysBefore = (tc['days_before'] as string) || '';
    this.triggerConfigLabelName = (tc['label_name'] as string) || '';
    this.triggerConfigFieldName = (tc['field_name'] as string) || '';

    // Populate actions
    this.actions.set(
      editing.actions.map((a) => ({
        id: crypto.randomUUID(),
        action_type: a.action_type,
        action_config: { ...a.action_config },
      })),
    );
  }

  private resetForm(): void {
    this.ruleName = '';
    this.selectedTrigger = 'task_moved';
    this.actions.set([]);
    this.triggerConfigFromColumn = '';
    this.triggerConfigToColumn = '';
    this.triggerConfigFromPriority = '';
    this.triggerConfigToPriority = '';
    this.triggerConfigAssignee = '';
    this.triggerConfigDaysBefore = '';
    this.triggerConfigLabelName = '';
    this.triggerConfigFieldName = '';
  }
}

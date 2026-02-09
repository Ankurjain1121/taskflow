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
  action_type: AutomationActionType;
  action_config: any;
}

@Component({
  selector: 'app-rule-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white border border-indigo-200 rounded-lg shadow-sm overflow-hidden">
      <!-- Header -->
      <div class="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
        <h4 class="text-sm font-semibold text-indigo-900">
          {{ editingRule() ? 'Edit Automation Rule' : 'Create Automation Rule' }}
        </h4>
      </div>

      <div class="p-4 space-y-5">
        <!-- Step 1: Name + Trigger -->
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</span>
            <span class="text-sm font-medium text-gray-700">Name & Trigger</span>
          </div>

          <input
            type="text"
            [(ngModel)]="ruleName"
            placeholder="Rule name (e.g., Auto-assign on create)"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />

          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">When this happens...</label>
            <select
              [(ngModel)]="selectedTrigger"
              (ngModelChange)="onTriggerChange()"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              @for (opt of triggerOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
            <p class="mt-1 text-xs text-gray-400">{{ getSelectedTriggerDescription() }}</p>
          </div>
        </div>

        <!-- Step 2: Trigger Config -->
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</span>
            <span class="text-sm font-medium text-gray-700">Trigger Conditions</span>
          </div>

          <div class="bg-gray-50 rounded-md p-3 space-y-2">
            @switch (selectedTrigger) {
              @case ('task_moved') {
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">From Column (optional)</label>
                    <input
                      type="text"
                      [(ngModel)]="triggerConfigFromColumn"
                      placeholder="Any column"
                      class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">To Column (optional)</label>
                    <input
                      type="text"
                      [(ngModel)]="triggerConfigToColumn"
                      placeholder="Any column"
                      class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              }
              @case ('task_priority_changed') {
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">From Priority (optional)</label>
                    <select
                      [(ngModel)]="triggerConfigFromPriority"
                      class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Any priority</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">To Priority (optional)</label>
                    <select
                      [(ngModel)]="triggerConfigToPriority"
                      class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                  <label class="block text-xs font-medium text-gray-500 mb-1">Assigned To (User ID, optional)</label>
                  <input
                    type="text"
                    [(ngModel)]="triggerConfigAssignee"
                    placeholder="Any user"
                    class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              }
              @default {
                <p class="text-xs text-gray-400">No additional configuration needed for this trigger.</p>
              }
            }
          </div>
        </div>

        <!-- Step 3: Actions -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">3</span>
              <span class="text-sm font-medium text-gray-700">Actions</span>
            </div>
            <button
              (click)="addAction()"
              class="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              + Add Action
            </button>
          </div>

          @if (actions().length === 0) {
            <div class="bg-gray-50 rounded-md p-3 text-center">
              <p class="text-xs text-gray-400">Add at least one action to define what happens.</p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (action of actions(); track $index; let i = $index) {
                <div class="bg-gray-50 rounded-md p-3 relative">
                  <!-- Remove button -->
                  <button
                    (click)="removeAction(i)"
                    class="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors"
                    title="Remove action"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div class="space-y-2">
                    <div>
                      <label class="block text-xs font-medium text-gray-500 mb-1">Action {{ i + 1 }}</label>
                      <select
                        [ngModel]="action.action_type"
                        (ngModelChange)="updateActionType(i, $event)"
                        class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      >
                        @for (opt of actionOptions; track opt.value) {
                          <option [value]="opt.value">{{ opt.label }}</option>
                        }
                      </select>
                      <p class="mt-0.5 text-xs text-gray-400">{{ getActionDescription(action.action_type) }}</p>
                    </div>

                    <!-- Action-specific config -->
                    @switch (action.action_type) {
                      @case ('move_task') {
                        <div>
                          <label class="block text-xs font-medium text-gray-500 mb-1">Target Column Name</label>
                          <input
                            type="text"
                            [ngModel]="action.action_config.target_column || ''"
                            (ngModelChange)="updateActionConfig(i, 'target_column', $event)"
                            placeholder="e.g., Done, In Review"
                            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      }
                      @case ('assign_task') {
                        <div>
                          <label class="block text-xs font-medium text-gray-500 mb-1">Assign To (User ID)</label>
                          <input
                            type="text"
                            [ngModel]="action.action_config.assignee_id || ''"
                            (ngModelChange)="updateActionConfig(i, 'assignee_id', $event)"
                            placeholder="User ID"
                            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      }
                      @case ('set_priority') {
                        <div>
                          <label class="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                          <select
                            [ngModel]="action.action_config.priority || ''"
                            (ngModelChange)="updateActionConfig(i, 'priority', $event)"
                            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                          <label class="block text-xs font-medium text-gray-500 mb-1">Notification Message</label>
                          <input
                            type="text"
                            [ngModel]="action.action_config.message || ''"
                            (ngModelChange)="updateActionConfig(i, 'message', $event)"
                            placeholder="Notification message..."
                            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      }
                      @case ('add_label') {
                        <div>
                          <label class="block text-xs font-medium text-gray-500 mb-1">Label Name</label>
                          <input
                            type="text"
                            [ngModel]="action.action_config.label || ''"
                            (ngModelChange)="updateActionConfig(i, 'label', $event)"
                            placeholder="e.g., urgent, reviewed"
                            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      }
                      @case ('set_milestone') {
                        <div>
                          <label class="block text-xs font-medium text-gray-500 mb-1">Milestone ID</label>
                          <input
                            type="text"
                            [ngModel]="action.action_config.milestone_id || ''"
                            (ngModelChange)="updateActionConfig(i, 'milestone_id', $event)"
                            placeholder="Milestone ID"
                            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
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
        <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            (click)="cancel()"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            (click)="save()"
            [disabled]="!canSave()"
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

  saving = signal(false);

  triggerOptions: TriggerOption[] = [
    { value: 'task_moved', label: 'Task Moved', description: 'Fires when a task is moved between columns.' },
    { value: 'task_created', label: 'Task Created', description: 'Fires when a new task is created on the board.' },
    { value: 'task_assigned', label: 'Task Assigned', description: 'Fires when a task is assigned to a user.' },
    { value: 'task_priority_changed', label: 'Priority Changed', description: 'Fires when a task priority is changed.' },
    { value: 'task_due_date_passed', label: 'Due Date Passed', description: 'Fires when a task due date has passed.' },
    { value: 'task_completed', label: 'Task Completed', description: 'Fires when a task is marked as completed.' },
  ];

  actionOptions: ActionOption[] = [
    { value: 'move_task', label: 'Move Task', description: 'Move the task to a specific column.' },
    { value: 'assign_task', label: 'Assign Task', description: 'Assign the task to a specific user.' },
    { value: 'set_priority', label: 'Set Priority', description: 'Change the task priority level.' },
    { value: 'send_notification', label: 'Send Notification', description: 'Send a notification to relevant users.' },
    { value: 'add_label', label: 'Add Label', description: 'Add a label to the task.' },
    { value: 'set_milestone', label: 'Set Milestone', description: 'Assign the task to a milestone.' },
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
    const opt = this.triggerOptions.find((t) => t.value === this.selectedTrigger);
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
  }

  addAction(): void {
    this.actions.update((actions) => [
      ...actions,
      { action_type: 'move_task' as AutomationActionType, action_config: {} },
    ]);
  }

  removeAction(index: number): void {
    this.actions.update((actions) => actions.filter((_, i) => i !== index));
  }

  updateActionType(index: number, newType: AutomationActionType): void {
    this.actions.update((actions) =>
      actions.map((a, i) =>
        i === index ? { ...a, action_type: newType, action_config: {} } : a
      )
    );
  }

  updateActionConfig(index: number, key: string, value: string): void {
    this.actions.update((actions) =>
      actions.map((a, i) =>
        i === index
          ? { ...a, action_config: { ...a.action_config, [key]: value } }
          : a
      )
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
          console.error('Failed to update automation rule:', err);
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
          console.error('Failed to create automation rule:', err);
          this.saving.set(false);
        },
      });
    }
  }

  private buildTriggerConfig(): any {
    switch (this.selectedTrigger) {
      case 'task_moved': {
        const config: any = {};
        if (this.triggerConfigFromColumn.trim()) config.from_column = this.triggerConfigFromColumn.trim();
        if (this.triggerConfigToColumn.trim()) config.to_column = this.triggerConfigToColumn.trim();
        return config;
      }
      case 'task_priority_changed': {
        const config: any = {};
        if (this.triggerConfigFromPriority) config.from_priority = this.triggerConfigFromPriority;
        if (this.triggerConfigToPriority) config.to_priority = this.triggerConfigToPriority;
        return config;
      }
      case 'task_assigned': {
        const config: any = {};
        if (this.triggerConfigAssignee.trim()) config.assignee_id = this.triggerConfigAssignee.trim();
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
    this.triggerConfigFromColumn = tc.from_column || '';
    this.triggerConfigToColumn = tc.to_column || '';
    this.triggerConfigFromPriority = tc.from_priority || '';
    this.triggerConfigToPriority = tc.to_priority || '';
    this.triggerConfigAssignee = tc.assignee_id || '';

    // Populate actions
    this.actions.set(
      editing.actions.map((a) => ({
        action_type: a.action_type,
        action_config: { ...a.action_config },
      }))
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
  }
}

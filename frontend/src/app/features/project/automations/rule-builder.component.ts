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
  templateUrl: './rule-builder.component.html',
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
    {
      value: 'member_joined',
      label: 'Member Joined',
      description: 'Fires when a new member joins the workspace.',
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
    {
      value: 'assign_to_role_members',
      label: 'Assign to Role Members',
      description: 'Assign the task to all members with a specific job role.',
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

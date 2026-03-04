import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { TaskCustomFieldValueWithField } from '../../../core/services/custom-field.service';
import { toDate, getDropdownSelectOptions } from './task-fields-utils';

@Component({
  selector: 'app-task-custom-fields-section',
  standalone: true,
  imports: [CommonModule, FormsModule, Select, DatePicker, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (customFields().length > 0) {
      <div class="border-t border-[var(--border)] pt-6">
        <div class="flex items-center gap-2 mb-3">
          <i class="pi pi-clipboard text-gray-400"></i>
          <h3 class="text-sm font-medium text-[var(--card-foreground)]">
            Custom Fields
          </h3>
        </div>
        <div class="space-y-3">
          @for (cf of customFields(); track cf.field_id) {
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-[var(--muted-foreground)]">
                {{ cf.field_name }}
                @if (cf.is_required) {
                  <span class="text-red-500">*</span>
                }
              </label>
              @switch (cf.field_type) {
                @case ('text') {
                  <input
                    pInputText
                    type="text"
                    [ngModel]="cf.value_text || ''"
                    (ngModelChange)="
                      onCustomFieldTextChange(cf.field_id, $event)
                    "
                    (blur)="customFieldSaveRequested.emit()"
                    class="w-full"
                    placeholder="Enter text..."
                  />
                }
                @case ('number') {
                  <input
                    pInputText
                    type="number"
                    [ngModel]="cf.value_number"
                    (ngModelChange)="
                      onCustomFieldNumberChange(cf.field_id, $event)
                    "
                    (blur)="customFieldSaveRequested.emit()"
                    class="w-full"
                    placeholder="Enter number..."
                  />
                }
                @case ('date') {
                  <p-datePicker
                    [ngModel]="cf.value_date ? toDate(cf.value_date) : null"
                    (ngModelChange)="
                      onCustomFieldDateChange(cf.field_id, $event)
                    "
                    dateFormat="yy-mm-dd"
                    [showIcon]="true"
                    [showClear]="true"
                    styleClass="w-full"
                  />
                }
                @case ('dropdown') {
                  <p-select
                    [ngModel]="cf.value_text || ''"
                    (ngModelChange)="
                      onCustomFieldDropdownChange(cf.field_id, $event)
                    "
                    [options]="getDropdownSelectOptions(cf.options)"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Select..."
                    [showClear]="true"
                    styleClass="w-full"
                  />
                }
                @case ('checkbox') {
                  <label class="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      [ngModel]="cf.value_bool || false"
                      (ngModelChange)="
                        onCustomFieldCheckboxChange(cf.field_id, $event)
                      "
                      class="rounded border-[var(--border)] text-primary focus:ring-ring"
                    />
                    <span class="text-sm text-[var(--foreground)]">{{
                      cf.value_bool ? 'Yes' : 'No'
                    }}</span>
                  </label>
                }
              }
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class TaskCustomFieldsSectionComponent {
  customFields = input<TaskCustomFieldValueWithField[]>([]);

  customFieldChanged = output<{
    fieldId: string;
    field: string;
    value: unknown;
  }>();
  customFieldSaveRequested = output<void>();

  toDate = toDate;
  getDropdownSelectOptions = getDropdownSelectOptions;

  onCustomFieldTextChange(fieldId: string, value: string): void {
    this.customFieldChanged.emit({
      fieldId,
      field: 'value_text',
      value: value || null,
    });
  }

  onCustomFieldNumberChange(fieldId: string, value: number | null): void {
    this.customFieldChanged.emit({ fieldId, field: 'value_number', value });
  }

  onCustomFieldDateChange(fieldId: string, date: Date | null): void {
    const dateValue = date ? date.toISOString().split('T')[0] : '';
    this.customFieldChanged.emit({
      fieldId,
      field: 'value_date',
      value: dateValue ? new Date(dateValue).toISOString() : null,
    });
    this.customFieldSaveRequested.emit();
  }

  onCustomFieldDropdownChange(fieldId: string, value: string): void {
    this.customFieldChanged.emit({
      fieldId,
      field: 'value_text',
      value: value || null,
    });
    this.customFieldSaveRequested.emit();
  }

  onCustomFieldCheckboxChange(fieldId: string, value: boolean): void {
    this.customFieldChanged.emit({ fieldId, field: 'value_bool', value });
    this.customFieldSaveRequested.emit();
  }
}

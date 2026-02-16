import { Component, ChangeDetectionStrategy, input, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Accordion, AccordionPanel, AccordionHeader, AccordionContent } from 'primeng/accordion';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Tooltip } from 'primeng/tooltip';
import { Chip } from 'primeng/chip';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  WebhookService, Webhook, WebhookDelivery,
  CreateWebhookRequest, UpdateWebhookRequest,
} from '../../../core/services/webhook.service';

const AVAILABLE_EVENTS = [
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.updated', label: 'Task Updated' },
  { value: 'task.deleted', label: 'Task Deleted' },
  { value: 'task.moved', label: 'Task Moved' },
  { value: 'task.assigned', label: 'Task Assigned' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'comment.created', label: 'Comment Created' },
  { value: 'member.added', label: 'Member Added' },
  { value: 'member.removed', label: 'Member Removed' },
];

@Component({
  selector: 'app-webhook-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, Card, ToggleSwitch,
    InputText, Select, Accordion, AccordionPanel, AccordionHeader, AccordionContent,
    ProgressSpinner, Tooltip, Chip, Toast,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <div class="p-6 max-w-3xl mx-auto">
      <h2 class="text-xl font-semibold mb-4">Webhooks</h2>
      <p class="text-gray-600 mb-6">Send HTTP POST requests to external services when events occur on this board.</p>

      <!-- Create form -->
      @if (showCreateForm()) {
        <p-card class="mb-6">
          <div class="p-4">
            <h3 class="font-medium mb-3">New Webhook</h3>
            <div class="space-y-4">
              <div class="flex flex-col gap-2 w-full">
                <label for="webhookUrl" class="text-sm font-medium">Payload URL</label>
                <input pInputText id="webhookUrl" [(ngModel)]="newUrl" placeholder="https://example.com/webhook" class="w-full" />
              </div>
              <div class="flex flex-col gap-2 w-full">
                <label for="webhookSecret" class="text-sm font-medium">Secret (optional)</label>
                <input pInputText id="webhookSecret" [(ngModel)]="newSecret" type="password" placeholder="Used to sign payloads" class="w-full" />
              </div>
              <div class="flex flex-col gap-2 w-full">
                <label for="webhookEvents" class="text-sm font-medium">Events</label>
                <p-select
                  id="webhookEvents"
                  [(ngModel)]="newEvents"
                  [options]="availableEvents"
                  optionLabel="label"
                  optionValue="value"
                  [multiple]="true"
                  placeholder="Select events"
                  class="w-full"
                />
              </div>
              <div class="flex gap-2">
                <button pButton label="Create Webhook" (click)="createWebhook()"
                  [disabled]="creating() || !newUrl || newEvents.length === 0">
                  @if (creating()) {
                    <p-progressSpinner [style]="{width: '18px', height: '18px'}" strokeWidth="4" class="inline-block mr-2" />
                  }
                </button>
                <button pButton [text]="true" label="Cancel" (click)="showCreateForm.set(false)"></button>
              </div>
            </div>
          </div>
        </p-card>
      } @else {
        <button pButton label="Add Webhook" icon="pi pi-plus" class="mb-6" (click)="showCreateForm.set(true)"></button>
      }

      <!-- Webhook list -->
      @if (loading()) {
        <div class="flex justify-center py-8">
          <p-progressSpinner [style]="{width: '40px', height: '40px'}" strokeWidth="4" />
        </div>
      } @else if (webhooks().length === 0) {
        <div class="text-center text-gray-500 py-8">
          No webhooks configured yet.
        </div>
      } @else {
        <p-accordion>
          @for (webhook of webhooks(); track webhook.id) {
            <p-accordionPanel>
              <p-accordionHeader>
                <div class="flex items-center gap-2 flex-1">
                  <span class="w-2 h-2 rounded-full" [class.bg-green-500]="webhook.is_active" [class.bg-gray-400]="!webhook.is_active"></span>
                  <span class="truncate max-w-xs">{{ webhook.url }}</span>
                  <span class="text-xs text-gray-500 ml-auto mr-4">{{ webhook.events.length }} events</span>
                </div>
              </p-accordionHeader>
              <p-accordionContent>
                <div class="space-y-3 pt-2">
                  <!-- Events -->
                  <div>
                    <span class="text-sm font-medium text-gray-600">Events:</span>
                    <div class="flex flex-wrap gap-1 mt-1">
                      @for (event of webhook.events; track event) {
                        <p-chip [label]="event" styleClass="text-xs" />
                      }
                    </div>
                  </div>

                  <!-- Controls -->
                  <div class="flex items-center gap-3 border-t pt-3">
                    <p-toggleSwitch [(ngModel)]="webhook.is_active"
                      (onChange)="toggleWebhook(webhook, $event.checked)" />
                    <span class="text-sm">{{ webhook.is_active ? 'Active' : 'Inactive' }}</span>
                    <button pButton [text]="true" label="Deliveries" icon="pi pi-history" (click)="loadDeliveries(webhook.id)"></button>
                    <button pButton [text]="true" severity="danger" label="Delete" icon="pi pi-trash" (click)="deleteWebhook(webhook)"></button>
                  </div>

                  <!-- Deliveries (if loaded) -->
                  @if (deliveriesMap()[webhook.id]) {
                    <div class="border-t pt-3">
                      <h4 class="text-sm font-medium mb-2">Recent Deliveries</h4>
                      @if (deliveriesMap()[webhook.id]!.length === 0) {
                        <p class="text-sm text-gray-500">No deliveries yet.</p>
                      } @else {
                        <div class="space-y-1">
                          @for (d of deliveriesMap()[webhook.id]!; track d.id) {
                            <div class="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                              <span class="w-2 h-2 rounded-full" [class.bg-green-500]="d.success" [class.bg-red-500]="!d.success"></span>
                              <span class="font-mono">{{ d.event_type }}</span>
                              <span class="text-gray-400">{{ d.delivered_at | date:'short' }}</span>
                              @if (d.response_status) {
                                <span class="ml-auto" [class.text-green-600]="d.response_status < 400" [class.text-red-600]="d.response_status >= 400">
                                  {{ d.response_status }}
                                </span>
                              }
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              </p-accordionContent>
            </p-accordionPanel>
          }
        </p-accordion>
      }
    </div>
  `,
})
export class WebhookSettingsComponent implements OnInit {
  boardId = input.required<string>();

  private webhookService = inject(WebhookService);
  private messageService = inject(MessageService);

  webhooks = signal<Webhook[]>([]);
  loading = signal(true);
  creating = signal(false);
  showCreateForm = signal(false);
  deliveriesMap = signal<Record<string, WebhookDelivery[]>>({});

  availableEvents = AVAILABLE_EVENTS;
  newUrl = '';
  newSecret = '';
  newEvents: string[] = [];

  ngOnInit() {
    this.loadWebhooks();
  }

  loadWebhooks() {
    this.loading.set(true);
    this.webhookService.listWebhooks(this.boardId()).subscribe({
      next: (webhooks) => {
        this.webhooks.set(webhooks);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  createWebhook() {
    this.creating.set(true);
    const req: CreateWebhookRequest = {
      url: this.newUrl,
      events: this.newEvents,
    };
    if (this.newSecret) req.secret = this.newSecret;

    this.webhookService.createWebhook(this.boardId(), req).subscribe({
      next: (webhook) => {
        this.webhooks.update((w) => [webhook, ...w]);
        this.creating.set(false);
        this.showCreateForm.set(false);
        this.newUrl = '';
        this.newSecret = '';
        this.newEvents = [];
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Webhook created' });
      },
      error: () => {
        this.creating.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create webhook' });
      },
    });
  }

  toggleWebhook(webhook: Webhook, isActive: boolean) {
    this.webhookService.updateWebhook(webhook.id, { is_active: isActive }).subscribe({
      next: (updated) => {
        this.webhooks.update((w) => w.map((wh) => (wh.id === updated.id ? updated : wh)));
      },
    });
  }

  deleteWebhook(webhook: Webhook) {
    this.webhookService.deleteWebhook(webhook.id).subscribe({
      next: () => {
        this.webhooks.update((w) => w.filter((wh) => wh.id !== webhook.id));
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Webhook deleted' });
      },
    });
  }

  loadDeliveries(webhookId: string) {
    this.webhookService.getDeliveries(webhookId).subscribe({
      next: (deliveries) => {
        this.deliveriesMap.update((m) => ({ ...m, [webhookId]: deliveries }));
      },
    });
  }
}

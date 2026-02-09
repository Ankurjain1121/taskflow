import { Component, ChangeDetectionStrategy, input, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
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
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatSlideToggleModule, MatInputModule, MatFormFieldModule, MatChipsModule,
    MatSnackBarModule, MatExpansionModule, MatSelectModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-3xl mx-auto">
      <h2 class="text-xl font-semibold mb-4">Webhooks</h2>
      <p class="text-gray-600 mb-6">Send HTTP POST requests to external services when events occur on this board.</p>

      <!-- Create form -->
      @if (showCreateForm()) {
        <mat-card class="mb-6">
          <mat-card-content class="p-4">
            <h3 class="font-medium mb-3">New Webhook</h3>
            <div class="space-y-4">
              <mat-form-field class="w-full">
                <mat-label>Payload URL</mat-label>
                <input matInput [(ngModel)]="newUrl" placeholder="https://example.com/webhook">
              </mat-form-field>
              <mat-form-field class="w-full">
                <mat-label>Secret (optional)</mat-label>
                <input matInput [(ngModel)]="newSecret" type="password" placeholder="Used to sign payloads">
              </mat-form-field>
              <mat-form-field class="w-full">
                <mat-label>Events</mat-label>
                <mat-select [(ngModel)]="newEvents" multiple>
                  @for (event of availableEvents; track event.value) {
                    <mat-option [value]="event.value">{{ event.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <div class="flex gap-2">
                <button mat-raised-button color="primary" (click)="createWebhook()"
                  [disabled]="creating() || !newUrl || newEvents.length === 0">
                  @if (creating()) {
                    <mat-spinner diameter="18" class="inline-block mr-2"></mat-spinner>
                  }
                  Create Webhook
                </button>
                <button mat-button (click)="showCreateForm.set(false)">Cancel</button>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      } @else {
        <button mat-raised-button color="primary" class="mb-6" (click)="showCreateForm.set(true)">
          <mat-icon>add</mat-icon> Add Webhook
        </button>
      }

      <!-- Webhook list -->
      @if (loading()) {
        <div class="flex justify-center py-8">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (webhooks().length === 0) {
        <div class="text-center text-gray-500 py-8">
          No webhooks configured yet.
        </div>
      } @else {
        <mat-accordion>
          @for (webhook of webhooks(); track webhook.id) {
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full" [class.bg-green-500]="webhook.is_active" [class.bg-gray-400]="!webhook.is_active"></span>
                  <span class="truncate max-w-xs">{{ webhook.url }}</span>
                </mat-panel-title>
                <mat-panel-description class="flex items-center gap-2">
                  <span class="text-xs">{{ webhook.events.length }} events</span>
                </mat-panel-description>
              </mat-expansion-panel-header>

              <div class="space-y-3 pt-2">
                <!-- Events -->
                <div>
                  <span class="text-sm font-medium text-gray-600">Events:</span>
                  <div class="flex flex-wrap gap-1 mt-1">
                    @for (event of webhook.events; track event) {
                      <span class="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">{{ event }}</span>
                    }
                  </div>
                </div>

                <!-- Controls -->
                <div class="flex items-center gap-3 border-t pt-3">
                  <mat-slide-toggle [checked]="webhook.is_active"
                    (change)="toggleWebhook(webhook, $event.checked)">
                    {{ webhook.is_active ? 'Active' : 'Inactive' }}
                  </mat-slide-toggle>
                  <button mat-button color="primary" (click)="loadDeliveries(webhook.id)">
                    <mat-icon>history</mat-icon> Deliveries
                  </button>
                  <button mat-button color="warn" (click)="deleteWebhook(webhook)">
                    <mat-icon>delete</mat-icon> Delete
                  </button>
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
            </mat-expansion-panel>
          }
        </mat-accordion>
      }
    </div>
  `,
})
export class WebhookSettingsComponent implements OnInit {
  boardId = input.required<string>();

  private webhookService = inject(WebhookService);
  private snackBar = inject(MatSnackBar);

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
        this.snackBar.open('Webhook created', 'OK', { duration: 3000 });
      },
      error: () => {
        this.creating.set(false);
        this.snackBar.open('Failed to create webhook', 'OK', { duration: 3000 });
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
        this.snackBar.open('Webhook deleted', 'OK', { duration: 2000 });
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

import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ProjectShareService,
  ProjectShare,
  CreateShareRequest,
} from '../../../core/services/board-share.service';
import { Clipboard } from '@angular/cdk/clipboard';

@Component({
  selector: 'app-share-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    Card,
    ToggleSwitch,
    InputText,
    Tooltip,
    ProgressSpinner,
    Toast,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <div class="p-6 max-w-3xl mx-auto">
      <h2 class="text-xl font-semibold mb-4">Share Settings</h2>
      <p class="text-gray-600 mb-6">
        Create shareable links to give external users read-only access to this
        board.
      </p>

      <!-- Create new share -->
      <p-card class="mb-6">
        <div class="p-4">
          <h3 class="font-medium mb-3">Create New Share Link</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="flex flex-col gap-2">
              <label for="shareName" class="text-sm font-medium"
                >Link Name (optional)</label
              >
              <input
                pInputText
                id="shareName"
                [(ngModel)]="newShareName"
                placeholder="e.g. Client Review"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label for="sharePassword" class="text-sm font-medium"
                >Password (optional)</label
              >
              <input
                pInputText
                id="sharePassword"
                [(ngModel)]="newSharePassword"
                type="password"
                placeholder="Leave blank for no password"
              />
            </div>
          </div>
          <div class="flex items-center gap-4 mb-4">
            <p-toggleSwitch [(ngModel)]="newShareViewComments" />
            <span class="text-sm">Allow viewing comments</span>
          </div>
          <button
            pButton
            label="Create Share Link"
            (click)="createShare()"
            [disabled]="creating()"
          >
            @if (creating()) {
              <p-progressSpinner
                [style]="{ width: '20px', height: '20px' }"
                strokeWidth="4"
                class="inline-block mr-2"
              />
            }
          </button>
        </div>
      </p-card>

      <!-- Existing shares -->
      @if (loading()) {
        <div class="flex justify-center py-8">
          <p-progressSpinner
            [style]="{ width: '40px', height: '40px' }"
            strokeWidth="4"
          />
        </div>
      } @else if (shares().length === 0) {
        <div class="text-center text-gray-500 py-8">
          No share links created yet.
        </div>
      } @else {
        <div class="space-y-3">
          @for (share of shares(); track share.id) {
            <p-card>
              <div class="p-4">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-medium">{{
                        share.name || 'Unnamed Link'
                      }}</span>
                      @if (!share.is_active) {
                        <span
                          class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded"
                          >Inactive</span
                        >
                      }
                      @if (share.expires_at) {
                        <span class="text-xs text-gray-500"
                          >Expires: {{ share.expires_at | date: 'short' }}</span
                        >
                      }
                    </div>
                    <div
                      class="text-sm text-gray-500 font-mono truncate max-w-md"
                    >
                      {{ getShareUrl(share) }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      pButton
                      [rounded]="true"
                      [text]="true"
                      pTooltip="Copy Link"
                      (click)="copyLink(share)"
                    >
                      <i class="pi pi-copy"></i>
                    </button>
                    <p-toggleSwitch
                      [(ngModel)]="share.is_active"
                      (onChange)="toggleShare(share, $event.checked)"
                      pTooltip="Toggle active"
                    />
                    <button
                      pButton
                      [rounded]="true"
                      [text]="true"
                      severity="danger"
                      pTooltip="Delete"
                      (click)="deleteShare(share)"
                    >
                      <i class="pi pi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </p-card>
          }
        </div>
      }
    </div>
  `,
})
export class ShareSettingsComponent implements OnInit {
  boardId = input.required<string>();

  private shareService = inject(ProjectShareService);
  private clipboard = inject(Clipboard);
  private messageService = inject(MessageService);

  shares = signal<ProjectShare[]>([]);
  loading = signal(true);
  creating = signal(false);

  newShareName = '';
  newSharePassword = '';
  newShareViewComments = false;

  ngOnInit() {
    this.loadShares();
  }

  loadShares() {
    this.loading.set(true);
    this.shareService.listShares(this.boardId()).subscribe({
      next: (shares) => {
        this.shares.set(shares);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  createShare() {
    this.creating.set(true);
    const req: CreateShareRequest = {
      permissions: {
        view_tasks: true,
        view_comments: this.newShareViewComments,
      },
    };
    if (this.newShareName) req.name = this.newShareName;
    if (this.newSharePassword) req.password = this.newSharePassword;

    this.shareService.createShare(this.boardId(), req).subscribe({
      next: (share) => {
        this.shares.update((s) => [share, ...s]);
        this.creating.set(false);
        this.newShareName = '';
        this.newSharePassword = '';
        this.newShareViewComments = false;
        this.copyLink(share);
        this.messageService.add({
          severity: 'success',
          summary: 'Created',
          detail: 'Share link created and copied!',
        });
      },
      error: () => {
        this.creating.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to create share link',
        });
      },
    });
  }

  getShareUrl(share: ProjectShare): string {
    return `${window.location.origin}/shared/${share.share_token}`;
  }

  copyLink(share: ProjectShare) {
    this.clipboard.copy(this.getShareUrl(share));
    this.messageService.add({
      severity: 'info',
      summary: 'Copied',
      detail: 'Link copied to clipboard',
    });
  }

  toggleShare(share: ProjectShare, isActive: boolean) {
    this.shareService.toggleShare(share.id, isActive).subscribe({
      next: (updated) => {
        this.shares.update((s) =>
          s.map((sh) => (sh.id === updated.id ? updated : sh)),
        );
      },
    });
  }

  deleteShare(share: ProjectShare) {
    this.shareService.deleteShare(share.id).subscribe({
      next: () => {
        this.shares.update((s) => s.filter((sh) => sh.id !== share.id));
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Share link deleted',
        });
      },
    });
  }
}

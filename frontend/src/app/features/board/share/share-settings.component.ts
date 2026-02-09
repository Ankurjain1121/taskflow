import { Component, ChangeDetectionStrategy, input, signal, inject, OnInit } from '@angular/core';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BoardShareService, BoardShare, CreateShareRequest } from '../../../core/services/board-share.service';
import { Clipboard } from '@angular/cdk/clipboard';

@Component({
  selector: 'app-share-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatSlideToggleModule, MatInputModule, MatFormFieldModule, MatChipsModule,
    MatSnackBarModule, MatTooltipModule, MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-3xl mx-auto">
      <h2 class="text-xl font-semibold mb-4">Share Settings</h2>
      <p class="text-gray-600 mb-6">Create shareable links to give external users read-only access to this board.</p>

      <!-- Create new share -->
      <mat-card class="mb-6">
        <mat-card-content class="p-4">
          <h3 class="font-medium mb-3">Create New Share Link</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <mat-form-field>
              <mat-label>Link Name (optional)</mat-label>
              <input matInput [(ngModel)]="newShareName" placeholder="e.g. Client Review">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Password (optional)</mat-label>
              <input matInput [(ngModel)]="newSharePassword" type="password" placeholder="Leave blank for no password">
            </mat-form-field>
          </div>
          <div class="flex items-center gap-4 mb-4">
            <mat-slide-toggle [(ngModel)]="newShareViewComments">Allow viewing comments</mat-slide-toggle>
          </div>
          <button mat-raised-button color="primary" (click)="createShare()" [disabled]="creating()">
            @if (creating()) {
              <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
            }
            Create Share Link
          </button>
        </mat-card-content>
      </mat-card>

      <!-- Existing shares -->
      @if (loading()) {
        <div class="flex justify-center py-8">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (shares().length === 0) {
        <div class="text-center text-gray-500 py-8">
          No share links created yet.
        </div>
      } @else {
        <div class="space-y-3">
          @for (share of shares(); track share.id) {
            <mat-card>
              <mat-card-content class="p-4">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-medium">{{ share.name || 'Unnamed Link' }}</span>
                      @if (!share.is_active) {
                        <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
                      }
                      @if (share.expires_at) {
                        <span class="text-xs text-gray-500">Expires: {{ share.expires_at | date:'short' }}</span>
                      }
                    </div>
                    <div class="text-sm text-gray-500 font-mono truncate max-w-md">
                      {{ getShareUrl(share) }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button mat-icon-button matTooltip="Copy Link" (click)="copyLink(share)">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                    <mat-slide-toggle
                      [checked]="share.is_active"
                      (change)="toggleShare(share, $event.checked)"
                      matTooltip="Toggle active">
                    </mat-slide-toggle>
                    <button mat-icon-button color="warn" matTooltip="Delete" (click)="deleteShare(share)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
})
export class ShareSettingsComponent implements OnInit {
  boardId = input.required<string>();

  private shareService = inject(BoardShareService);
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);

  shares = signal<BoardShare[]>([]);
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
      permissions: { view_tasks: true, view_comments: this.newShareViewComments },
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
        this.snackBar.open('Share link created and copied!', 'OK', { duration: 3000 });
      },
      error: () => {
        this.creating.set(false);
        this.snackBar.open('Failed to create share link', 'OK', { duration: 3000 });
      },
    });
  }

  getShareUrl(share: BoardShare): string {
    return `${window.location.origin}/shared/${share.share_token}`;
  }

  copyLink(share: BoardShare) {
    this.clipboard.copy(this.getShareUrl(share));
    this.snackBar.open('Link copied to clipboard', 'OK', { duration: 2000 });
  }

  toggleShare(share: BoardShare, isActive: boolean) {
    this.shareService.toggleShare(share.id, isActive).subscribe({
      next: (updated) => {
        this.shares.update((s) => s.map((sh) => (sh.id === updated.id ? updated : sh)));
      },
    });
  }

  deleteShare(share: BoardShare) {
    this.shareService.deleteShare(share.id).subscribe({
      next: () => {
        this.shares.update((s) => s.filter((sh) => sh.id !== share.id));
        this.snackBar.open('Share link deleted', 'OK', { duration: 2000 });
      },
    });
  }
}

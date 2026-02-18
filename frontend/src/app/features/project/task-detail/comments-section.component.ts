import { Component, inject, input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import {
  CommentService,
  Comment,
} from '../../../core/services/comment.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-comments-section',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule],
  template: `
    <div class="space-y-4">
      <div
        class="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
      >
        <i class="pi pi-comment !text-[14px]"></i>
        <span>Comments</span>
        @if (comments().length > 0) {
          <span class="text-gray-300 font-normal normal-case tracking-normal"
            >({{ comments().length }})</span
          >
        }
      </div>

      <!-- Comment form -->
      <div class="flex gap-3">
        <div
          class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs text-white font-semibold flex-shrink-0 mt-1 ring-2 ring-white dark:ring-gray-900"
        >
          {{ currentUserInitial() }}
        </div>
        <div class="flex-1">
          <div
            class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all"
            [class]="
              commentFocused()
                ? 'ring-2 ring-indigo-500/20 border-indigo-400'
                : 'hover:border-gray-300 dark:hover:border-gray-600'
            "
          >
            <textarea
              class="w-full min-h-[72px] p-3 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800/50 border-0 focus:outline-none resize-y placeholder:text-gray-400"
              [(ngModel)]="newComment"
              placeholder="Write a comment..."
              (focus)="commentFocused.set(true)"
              (blur)="commentFocused.set(false)"
              (keydown.meta.enter)="submitComment()"
              (keydown.control.enter)="submitComment()"
            ></textarea>
            <div
              class="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700/50"
            >
              <span class="text-[10px] text-gray-400">Ctrl+Enter to send</span>
              <p-button
                label="Comment"
                size="small"
                [disabled]="!newComment.trim() || submitting()"
                [loading]="submitting()"
                (onClick)="submitComment()"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-4">
          <div
            class="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"
          ></div>
        </div>
      }

      <!-- Comments list -->
      @for (comment of topLevelComments(); track comment.id) {
        <div class="space-y-2">
          <!-- Top-level comment -->
          <ng-container
            *ngTemplateOutlet="
              commentTpl;
              context: { $implicit: comment, depth: 0 }
            "
          ></ng-container>

          <!-- Replies -->
          @for (reply of getReplies(comment.id); track reply.id) {
            <div class="ml-10">
              <ng-container
                *ngTemplateOutlet="
                  commentTpl;
                  context: { $implicit: reply, depth: 1 }
                "
              ></ng-container>
            </div>
          }
        </div>
      }

      @if (!loading() && comments().length === 0) {
        <div class="flex flex-col items-center py-6 gap-2">
          <div
            class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
          >
            <i
              class="pi pi-comments !text-[20px] text-gray-300 dark:text-gray-600"
            ></i>
          </div>
          <p class="text-sm text-gray-400">
            No comments yet. Start the conversation!
          </p>
        </div>
      }
    </div>

    <!-- Comment template -->
    <ng-template #commentTpl let-comment let-depth="depth">
      <div class="flex gap-3 group/comment">
        <!-- Avatar -->
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-semibold flex-shrink-0 ring-2 ring-white dark:ring-gray-900"
          [style.background-color]="getAvatarColor(comment.author.display_name)"
        >
          {{ comment.author.display_name.charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <!-- Comment bubble -->
          <div class="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3.5 py-2.5">
            <div class="flex items-center gap-2 mb-1">
              <span
                class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                >{{ comment.author.display_name }}</span
              >
              <span
                class="text-[10px] text-gray-400"
                [title]="comment.created_at | date: 'medium'"
              >
                {{ formatRelativeTime(comment.created_at) }}
              </span>
              @if (comment.created_at !== comment.updated_at) {
                <span class="text-[10px] text-gray-400 italic">(edited)</span>
              }
            </div>

            @if (editingCommentId() === comment.id) {
              <div class="mt-1">
                <textarea
                  class="w-full min-h-[40px] p-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  [(ngModel)]="editContent"
                ></textarea>
                <div class="flex gap-1.5 mt-1.5">
                  <p-button
                    label="Save"
                    size="small"
                    (onClick)="saveEdit(comment.id)"
                  />
                  <p-button
                    label="Cancel"
                    size="small"
                    [text]="true"
                    severity="secondary"
                    (onClick)="cancelEdit()"
                  />
                </div>
              </div>
            } @else {
              <p
                class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed"
              >
                {{ comment.content }}
              </p>
            }
          </div>

          <!-- Actions -->
          <div
            class="flex items-center gap-3 mt-1 ml-1 opacity-0 group-hover/comment:opacity-100 transition-opacity"
          >
            @if (depth === 0) {
              <button
                class="text-[11px] font-medium text-gray-400 hover:text-indigo-500 transition-colors"
                (click)="startReply(comment.id)"
              >
                Reply
              </button>
            }
            @if (comment.author_id === currentUserId()) {
              <button
                class="text-[11px] font-medium text-gray-400 hover:text-indigo-500 transition-colors"
                (click)="startEdit(comment)"
              >
                Edit
              </button>
              <button
                class="text-[11px] font-medium text-gray-400 hover:text-red-500 transition-colors"
                (click)="deleteComment(comment.id)"
              >
                Delete
              </button>
            }
          </div>

          <!-- Reply form -->
          @if (replyingToId() === comment.id) {
            <div class="mt-2.5 flex gap-2.5">
              <div
                class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] text-white font-semibold flex-shrink-0 mt-1"
              >
                {{ currentUserInitial() }}
              </div>
              <div class="flex-1">
                <textarea
                  class="w-full min-h-[48px] p-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-gray-400"
                  [(ngModel)]="replyContent"
                  placeholder="Write a reply..."
                ></textarea>
                <div class="flex gap-1.5 mt-1.5">
                  <p-button
                    label="Reply"
                    size="small"
                    (onClick)="submitReply(comment.id)"
                  />
                  <p-button
                    label="Cancel"
                    size="small"
                    [text]="true"
                    severity="secondary"
                    (onClick)="cancelReply()"
                  />
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </ng-template>
  `,
})
export class CommentsSectionComponent implements OnInit {
  private commentService = inject(CommentService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  taskId = input.required<string>();

  comments = signal<Comment[]>([]);
  loading = signal(true);
  submitting = signal(false);
  commentFocused = signal(false);
  newComment = '';
  editingCommentId = signal<string | null>(null);
  editContent = '';
  replyingToId = signal<string | null>(null);
  replyContent = '';

  currentUserId = () => this.authService.currentUser()?.id;
  currentUserInitial = () => {
    const name = this.authService.currentUser()?.name || '?';
    return name.charAt(0).toUpperCase();
  };

  topLevelComments = () => this.comments().filter((c) => !c.parent_id);

  getReplies(parentId: string): Comment[] {
    return this.comments().filter((c) => c.parent_id === parentId);
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#6366f1',
      '#8b5cf6',
      '#ec4899',
      '#f43f5e',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#06b6d4',
      '#3b82f6',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  ngOnInit(): void {
    this.loadComments();
  }

  submitComment(): void {
    if (!this.newComment.trim() || this.submitting()) return;
    this.submitting.set(true);

    this.commentService
      .create(this.taskId(), this.newComment.trim())
      .subscribe({
        next: (comment) => {
          this.comments.update((list) => [...list, comment]);
          this.newComment = '';
          this.submitting.set(false);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to post comment.',
            life: 3000,
          });
          this.submitting.set(false);
        },
      });
  }

  startReply(commentId: string): void {
    this.replyingToId.set(commentId);
    this.replyContent = '';
  }

  cancelReply(): void {
    this.replyingToId.set(null);
    this.replyContent = '';
  }

  submitReply(parentId: string): void {
    if (!this.replyContent.trim()) return;

    this.commentService
      .create(this.taskId(), this.replyContent.trim(), parentId)
      .subscribe({
        next: (comment) => {
          this.comments.update((list) => [...list, comment]);
          this.cancelReply();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to post reply.',
            life: 3000,
          });
        },
      });
  }

  startEdit(comment: Comment): void {
    this.editingCommentId.set(comment.id);
    this.editContent = comment.content;
  }

  cancelEdit(): void {
    this.editingCommentId.set(null);
    this.editContent = '';
  }

  saveEdit(commentId: string): void {
    if (!this.editContent.trim()) return;

    this.commentService.update(commentId, this.editContent.trim()).subscribe({
      next: (updated) => {
        this.comments.update((list) =>
          list.map((c) => (c.id === commentId ? updated : c)),
        );
        this.cancelEdit();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to update comment.',
          life: 3000,
        });
      },
    });
  }

  deleteComment(commentId: string): void {
    if (!confirm('Delete this comment?')) return;

    this.commentService.delete(commentId).subscribe({
      next: () => {
        this.comments.update((list) =>
          list.filter((c) => c.id !== commentId && c.parent_id !== commentId),
        );
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete comment.',
          life: 3000,
        });
      },
    });
  }

  formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private loadComments(): void {
    this.loading.set(true);
    this.commentService.listByTask(this.taskId()).subscribe({
      next: (comments) => {
        this.comments.set(comments);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load comments.',
          life: 3000,
        });
      },
    });
  }
}

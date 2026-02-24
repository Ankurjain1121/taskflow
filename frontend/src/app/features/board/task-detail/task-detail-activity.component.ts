import {
  Component,
  input,
  signal,
  inject,
  effect,
  Injector,
  OnInit,
  OnDestroy,
  untracked,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ButtonModule } from 'primeng/button';

import {
  CommentService,
  Comment,
} from '../../../core/services/comment.service';
import { AuthService } from '../../../core/services/auth.service';
import { AttachmentListComponent } from '../attachment-list/attachment-list.component';
import { FileUploadZoneComponent } from '../file-upload-zone/file-upload-zone.component';
import { Attachment } from '../../../core/services/attachment.service';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor/rich-text-editor.component';

interface CommentThread {
  comment: Comment;
  replies: Comment[];
}

@Component({
  selector: 'app-task-detail-activity',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    AttachmentListComponent,
    FileUploadZoneComponent,
    RichTextEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Comments Section -->
      <div>
        <div class="flex items-center gap-2 mb-4">
          <i class="pi pi-comments text-[var(--muted-foreground)]"></i>
          <h3 class="text-sm font-medium text-[var(--foreground)]">Comments</h3>
          @if (comments().length > 0) {
            <span
              class="text-xs text-[var(--muted-foreground)] bg-[var(--secondary)] px-1.5 py-0.5 rounded-full"
            >
              {{ comments().length }}
            </span>
          }
        </div>

        <!-- Comment Compose -->
        <div class="mb-4">
          <app-rich-text-editor
            [content]="newCommentText"
            [compact]="true"
            placeholder="Write a comment..."
            (contentChanged)="newCommentText = $event"
          />
          @if (newCommentText.trim()) {
            <div class="flex justify-end mt-1">
              <button
                pButton
                size="small"
                label="Comment"
                (click)="submitComment()"
                [loading]="submitting()"
              ></button>
            </div>
          }
        </div>

        <!-- Comment List -->
        @if (loading()) {
          <div class="text-center py-4 text-sm text-[var(--muted-foreground)]">
            Loading comments...
          </div>
        } @else if (threads().length === 0) {
          <div
            class="bg-[var(--secondary)] rounded-md p-4 text-center text-sm text-[var(--muted-foreground)]"
          >
            No comments yet. Be the first to comment.
          </div>
        } @else {
          <div class="space-y-3">
            @for (thread of threads(); track thread.comment.id) {
              <!-- Top-level comment -->
              <div class="group/comment">
                <div
                  class="flex gap-3 p-3 rounded-lg hover:bg-[var(--secondary)] transition-colors"
                >
                  <div
                    class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                    [style.background]="
                      thread.comment.author.avatar_url
                        ? 'transparent'
                        : getAvatarGradient(thread.comment.author.display_name)
                    "
                  >
                    @if (thread.comment.author.avatar_url) {
                      <img
                        [src]="thread.comment.author.avatar_url"
                        [alt]="thread.comment.author.display_name"
                        class="w-full h-full rounded-full object-cover"
                      />
                    } @else {
                      {{ getInitials(thread.comment.author.display_name) }}
                    }
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span
                        class="text-sm font-medium text-[var(--foreground)]"
                      >
                        {{ thread.comment.author.display_name }}
                      </span>
                      <span class="text-xs text-[var(--muted-foreground)]">
                        {{ formatTimestamp(thread.comment.created_at) }}
                      </span>
                      @if (
                        thread.comment.created_at !== thread.comment.updated_at
                      ) {
                        <span
                          class="text-xs text-[var(--muted-foreground)] italic"
                        >
                          (edited)
                        </span>
                      }
                    </div>

                    @if (editingCommentId() === thread.comment.id) {
                      <app-rich-text-editor
                        [content]="editCommentText"
                        [compact]="true"
                        (contentChanged)="editCommentText = $event"
                      />
                      <div class="flex gap-2 mt-1">
                        <button
                          pButton
                          size="small"
                          label="Save"
                          (click)="saveEdit(thread.comment.id)"
                          [loading]="submitting()"
                        ></button>
                        <button
                          pButton
                          size="small"
                          severity="secondary"
                          label="Cancel"
                          (click)="cancelEdit()"
                        ></button>
                      </div>
                    } @else {
                      <div
                        class="text-sm text-[var(--foreground)] break-words comment-content"
                        [innerHTML]="thread.comment.content"
                      ></div>

                      <!-- Actions -->
                      <div
                        class="flex items-center gap-3 mt-1 opacity-0 group-hover/comment:opacity-100 transition-opacity"
                      >
                        <button
                          (click)="startReply(thread.comment.id)"
                          class="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        >
                          Reply
                        </button>
                        @if (isOwnComment(thread.comment)) {
                          <button
                            (click)="startEdit(thread.comment)"
                            class="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          >
                            Edit
                          </button>
                          <button
                            (click)="deleteComment(thread.comment.id)"
                            class="text-xs text-[var(--muted-foreground)] hover:text-red-500"
                          >
                            Delete
                          </button>
                        }
                      </div>
                    }
                  </div>
                </div>

                <!-- Replies -->
                @if (thread.replies.length > 0) {
                  <div class="ml-11 space-y-1">
                    @for (reply of thread.replies; track reply.id) {
                      <div
                        class="group/reply flex gap-3 p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors"
                      >
                        <div
                          class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                          [style.background]="
                            reply.author.avatar_url
                              ? 'transparent'
                              : getAvatarGradient(reply.author.display_name)
                          "
                        >
                          @if (reply.author.avatar_url) {
                            <img
                              [src]="reply.author.avatar_url"
                              [alt]="reply.author.display_name"
                              class="w-full h-full rounded-full object-cover"
                            />
                          } @else {
                            {{ getInitials(reply.author.display_name) }}
                          }
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-0.5">
                            <span
                              class="text-xs font-medium text-[var(--foreground)]"
                            >
                              {{ reply.author.display_name }}
                            </span>
                            <span
                              class="text-xs text-[var(--muted-foreground)]"
                            >
                              {{ formatTimestamp(reply.created_at) }}
                            </span>
                            @if (reply.created_at !== reply.updated_at) {
                              <span
                                class="text-xs text-[var(--muted-foreground)] italic"
                              >
                                (edited)
                              </span>
                            }
                          </div>

                          @if (editingCommentId() === reply.id) {
                            <app-rich-text-editor
                              [content]="editCommentText"
                              [compact]="true"
                              (contentChanged)="editCommentText = $event"
                            />
                            <div class="flex gap-2 mt-1">
                              <button
                                pButton
                                size="small"
                                label="Save"
                                (click)="saveEdit(reply.id)"
                                [loading]="submitting()"
                              ></button>
                              <button
                                pButton
                                size="small"
                                severity="secondary"
                                label="Cancel"
                                (click)="cancelEdit()"
                              ></button>
                            </div>
                          } @else {
                            <div
                              class="text-sm text-[var(--foreground)] break-words comment-content"
                              [innerHTML]="reply.content"
                            ></div>
                            <div
                              class="flex items-center gap-3 mt-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity"
                            >
                              @if (isOwnComment(reply)) {
                                <button
                                  (click)="startEdit(reply)"
                                  class="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                >
                                  Edit
                                </button>
                                <button
                                  (click)="deleteComment(reply.id)"
                                  class="text-xs text-[var(--muted-foreground)] hover:text-red-500"
                                >
                                  Delete
                                </button>
                              }
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }

                <!-- Reply Input -->
                @if (replyingToId() === thread.comment.id) {
                  <div class="ml-11 mt-1">
                    <app-rich-text-editor
                      [content]="replyText"
                      [compact]="true"
                      placeholder="Write a reply..."
                      (contentChanged)="replyText = $event"
                    />
                    <div class="flex gap-2 mt-1">
                      <button
                        pButton
                        size="small"
                        label="Reply"
                        (click)="submitReply(thread.comment.id)"
                        [loading]="submitting()"
                      ></button>
                      <button
                        pButton
                        size="small"
                        severity="secondary"
                        label="Cancel"
                        (click)="cancelReply()"
                      ></button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Attachments Section -->
      <div>
        <div class="flex items-center gap-2 mb-4">
          <i class="pi pi-paperclip text-[var(--muted-foreground)]"></i>
          <h3 class="text-sm font-medium text-[var(--foreground)]">
            Attachments
          </h3>
        </div>

        <app-file-upload-zone
          [taskId]="taskId()"
          (uploadCompleted)="onUploadCompleted($event)"
        />

        <div class="mt-4">
          <app-attachment-list #attachmentList [taskId]="taskId()" />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .comment-content p {
        margin: 0 0 0.25em;
      }

      :host ::ng-deep .comment-content p:last-child {
        margin-bottom: 0;
      }

      :host ::ng-deep .comment-content a {
        color: var(--primary);
        text-decoration: underline;
      }

      :host ::ng-deep .comment-content strong {
        font-weight: 600;
      }

      :host ::ng-deep .comment-content ul,
      :host ::ng-deep .comment-content ol {
        padding-left: 1.5em;
        margin: 0.25em 0;
      }

      :host ::ng-deep .comment-content code {
        background: var(--muted);
        padding: 0.1em 0.3em;
        border-radius: 3px;
        font-size: 0.9em;
      }

      :host ::ng-deep .comment-content blockquote {
        border-left: 3px solid var(--border);
        padding-left: 0.75em;
        margin: 0.25em 0;
        color: var(--muted-foreground);
      }
    `,
  ],
})
export class TaskDetailActivityComponent implements OnInit, OnDestroy {
  private commentService = inject(CommentService);
  private authService = inject(AuthService);
  private injector = inject(Injector);
  private destroy$ = new Subject<void>();

  @ViewChild('attachmentList') attachmentList!: AttachmentListComponent;

  taskId = input.required<string>();

  comments = signal<Comment[]>([]);
  threads = signal<CommentThread[]>([]);
  loading = signal(false);
  submitting = signal(false);
  editingCommentId = signal<string | null>(null);
  replyingToId = signal<string | null>(null);

  newCommentText = '';
  editCommentText = '';
  replyText = '';

  ngOnInit(): void {
    effect(
      () => {
        const id = this.taskId();
        untracked(() => {
          if (id) {
            this.loadComments();
          }
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadComments(): void {
    this.loading.set(true);
    this.commentService
      .listByTask(this.taskId())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (comments) => {
          this.comments.set(comments);
          this.threads.set(this.buildThreads(comments));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  submitComment(): void {
    const content = this.newCommentText.trim();
    if (!content) return;

    this.submitting.set(true);
    this.commentService
      .create(this.taskId(), content)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (comment) => {
          this.comments.update((c) => [...c, comment]);
          this.threads.set(this.buildThreads(this.comments()));
          this.newCommentText = '';
          this.submitting.set(false);
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }

  submitReply(parentId: string): void {
    const content = this.replyText.trim();
    if (!content) return;

    this.submitting.set(true);
    this.commentService
      .create(this.taskId(), content, parentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (comment) => {
          this.comments.update((c) => [...c, comment]);
          this.threads.set(this.buildThreads(this.comments()));
          this.replyText = '';
          this.replyingToId.set(null);
          this.submitting.set(false);
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }

  startEdit(comment: Comment): void {
    this.editingCommentId.set(comment.id);
    this.editCommentText = comment.content;
  }

  cancelEdit(): void {
    this.editingCommentId.set(null);
    this.editCommentText = '';
  }

  saveEdit(commentId: string): void {
    const content = this.editCommentText.trim();
    if (!content) return;

    this.submitting.set(true);
    this.commentService
      .update(commentId, content)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.comments.update((comments) =>
            comments.map((c) => (c.id === commentId ? updated : c)),
          );
          this.threads.set(this.buildThreads(this.comments()));
          this.editingCommentId.set(null);
          this.editCommentText = '';
          this.submitting.set(false);
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }

  deleteComment(commentId: string): void {
    this.commentService
      .delete(commentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.comments.update((comments) =>
            comments.filter(
              (c) => c.id !== commentId && c.parent_id !== commentId,
            ),
          );
          this.threads.set(this.buildThreads(this.comments()));
        },
      });
  }

  startReply(parentId: string): void {
    this.replyingToId.set(parentId);
    this.replyText = '';
  }

  cancelReply(): void {
    this.replyingToId.set(null);
    this.replyText = '';
  }

  onUploadCompleted(attachment: Attachment): void {
    if (this.attachmentList) {
      this.attachmentList.addAttachment(attachment);
    }
  }

  isOwnComment(comment: Comment): boolean {
    const user = this.authService.currentUser();
    return user !== null && user.id === comment.author_id;
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarGradient(name: string): string {
    const gradients = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #3b82f6, #06b6d4)',
      'linear-gradient(135deg, #f59e0b, #ef4444)',
      'linear-gradient(135deg, #10b981, #14b8a6)',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  }

  private buildThreads(comments: Comment[]): CommentThread[] {
    const topLevel = comments.filter((c) => !c.parent_id);
    const repliesMap = new Map<string, Comment[]>();

    for (const comment of comments) {
      if (comment.parent_id) {
        const existing = repliesMap.get(comment.parent_id) ?? [];
        repliesMap.set(comment.parent_id, [...existing, comment]);
      }
    }

    return topLevel.map((comment) => ({
      comment,
      replies: repliesMap.get(comment.id) ?? [],
    }));
  }
}

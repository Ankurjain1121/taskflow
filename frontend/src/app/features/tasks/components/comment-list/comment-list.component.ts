import {
  Component,
  input,
  signal,
  effect,
  inject,
  OnDestroy,
  Pipe,
  PipeTransform,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { Subject, takeUntil, filter } from 'rxjs';

import { CommentService, Comment } from '../../../../core/services/comment.service';
import { WebSocketService, WebSocketMessage } from '../../../../core/services/websocket.service';
import { CommentInputComponent } from '../comment-input/comment-input.component';

/**
 * Pipe to transform @[name](id) mentions into styled HTML spans
 * SECURITY: Escapes HTML entities BEFORE applying mention transformation to prevent XSS
 */
@Pipe({
  name: 'renderMentions',
  standalone: true,
})
export class RenderMentionsPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(content: string): SafeHtml {
    // SECURITY: First escape all HTML to prevent XSS attacks
    // This ensures any malicious HTML/JS in user content is neutralized
    const escaped = this.escapeHtml(content);

    // Then apply mention styling (now safe because content is escaped)
    const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
    const rendered = escaped.replace(
      mentionRegex,
      '<span class="text-indigo-600 font-medium bg-indigo-50 px-1 rounded">@$1</span>'
    );
    return this.sanitizer.bypassSecurityTrustHtml(rendered);
  }

  /**
   * Escape HTML entities to prevent XSS
   * Uses browser's built-in text content encoding
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

interface CommentCreatedPayload {
  taskId: string;
  comment: Comment;
}

@Component({
  selector: 'app-comment-list',
  standalone: true,
  imports: [
    CommonModule,
    ProgressSpinnerModule,
    ButtonModule,
    RenderMentionsPipe,
    CommentInputComponent,
  ],
  template: `
    <div class="space-y-4">
      <!-- Comments list -->
      @if (isLoading()) {
        <div class="flex items-center justify-center py-8">
          <p-progressSpinner
            [style]="{ width: '32px', height: '32px' }"
            strokeWidth="4"
          />
          <span class="ml-3 text-gray-500">Loading comments...</span>
        </div>
      } @else if (comments().length === 0) {
        <div class="text-center py-8 text-gray-500">
          <i class="pi pi-comments text-4xl text-gray-300 mb-2 block"></i>
          <p>No comments yet. Be the first to comment!</p>
        </div>
      } @else {
        <div class="space-y-4">
          @for (comment of comments(); track comment.id) {
            <div
              class="bg-white rounded-lg border border-gray-200 p-4"
              [class.ml-8]="comment.parent_id"
            >
              <div class="flex items-start gap-3">
                <!-- Author avatar -->
                @if (comment.author.avatar_url) {
                  <img
                    [src]="comment.author.avatar_url"
                    [alt]="comment.author.display_name"
                    class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                } @else {
                  <div
                    class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium flex-shrink-0"
                  >
                    {{ getInitials(comment.author.display_name) }}
                  </div>
                }

                <div class="flex-1 min-w-0">
                  <!-- Author name and timestamp -->
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-medium text-gray-900">
                      {{ comment.author.display_name }}
                    </span>
                    <span class="text-xs text-gray-400">
                      {{ formatTimestamp(comment.created_at) }}
                    </span>
                    @if (comment.updated_at !== comment.created_at) {
                      <span class="text-xs text-gray-400 italic">(edited)</span>
                    }
                  </div>

                  <!-- Comment content with rendered mentions -->
                  <div
                    class="text-gray-700 text-sm whitespace-pre-wrap break-words"
                    [innerHTML]="comment.content | renderMentions"
                  ></div>

                  <!-- Reply button -->
                  @if (!comment.parent_id) {
                    <p-button
                      [text]="true"
                      size="small"
                      severity="secondary"
                      styleClass="mt-2 -ml-2 text-xs"
                      (onClick)="toggleReply(comment.id)"
                    >
                      <i class="pi pi-reply mr-1"></i>
                      Reply
                    </p-button>
                  }

                  <!-- Reply input -->
                  @if (replyingTo() === comment.id) {
                    <div class="mt-3">
                      <app-comment-input
                        [taskId]="taskId()"
                        [workspaceId]="workspaceId()"
                        [parentId]="comment.id"
                        (commentCreated)="onReplyCreated($event)"
                      />
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Main comment input -->
      <div class="mt-4">
        <app-comment-input
          [taskId]="taskId()"
          [workspaceId]="workspaceId()"
          (commentCreated)="onCommentCreated($event)"
        />
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class CommentListComponent implements OnDestroy {
  private commentService = inject(CommentService);
  private wsService = inject(WebSocketService);
  private destroy$ = new Subject<void>();

  taskId = input.required<string>();
  boardId = input.required<string>();
  workspaceId = input.required<string>();

  comments = signal<Comment[]>([]);
  isLoading = signal(false);
  replyingTo = signal<string | null>(null);

  constructor() {
    // Load comments when taskId changes
    effect(() => {
      const taskId = this.taskId();
      if (taskId) {
        this.loadComments();
        this.subscribeToWebSocket();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadComments(): void {
    this.isLoading.set(true);

    this.commentService
      .listByTask(this.taskId())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (comments) => {
          this.comments.set(comments);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to load comments:', error);
          this.isLoading.set(false);
        },
      });
  }

  onCommentCreated(comment: Comment): void {
    // Add new comment to the list
    this.comments.update((comments) => [...comments, comment]);
  }

  onReplyCreated(reply: Comment): void {
    // Add reply to the list (it will be positioned by backend ordering)
    this.comments.update((comments) => [...comments, reply]);
    this.replyingTo.set(null);
  }

  toggleReply(commentId: string): void {
    if (this.replyingTo() === commentId) {
      this.replyingTo.set(null);
    } else {
      this.replyingTo.set(commentId);
    }
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  }

  private subscribeToWebSocket(): void {
    // Subscribe to comment:created events on the board channel
    this.wsService.messages$
      .pipe(
        filter(
          (msg: WebSocketMessage) =>
            msg.type === 'comment:created'
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((message: WebSocketMessage) => {
        const payload = message.payload as CommentCreatedPayload;

        // Only add if it's for this task and not already in the list
        if (payload.taskId === this.taskId()) {
          const existingIds = new Set(this.comments().map((c) => c.id));
          if (!existingIds.has(payload.comment.id)) {
            this.comments.update((comments) => [...comments, payload.comment]);
          }
        }
      });
  }
}

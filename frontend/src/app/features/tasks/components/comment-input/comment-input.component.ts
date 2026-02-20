import {
  Component,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { OverlayModule, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Subject, takeUntil } from 'rxjs';

import {
  CommentService,
  Comment,
} from '../../../../core/services/comment.service';
import {
  MentionPopoverComponent,
  MemberSelectedEvent,
} from '../mention-popover/mention-popover.component';

@Component({
  selector: 'app-comment-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ProgressSpinnerModule,
    OverlayModule,
  ],
  template: `
    <div class="bg-[var(--card)] rounded-lg border border-[var(--border)] p-3">
      <textarea
        #textareaRef
        [(ngModel)]="content"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
        (blur)="onBlur()"
        placeholder="Write a comment... Use @ to mention someone"
        class="w-full border-0 resize-none focus:ring-0 focus:outline-none text-sm text-[var(--card-foreground)] placeholder-gray-400 min-h-[80px]"
        [disabled]="isSubmitting()"
        rows="3"
      ></textarea>

      <div
        class="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)]"
      >
        <div class="text-xs text-gray-400">
          Press &#64; to mention teammates
        </div>
        <p-button
          (onClick)="submitComment()"
          [disabled]="!content.trim() || isSubmitting()"
          size="small"
        >
          @if (isSubmitting()) {
            <p-progressSpinner
              [style]="{ width: '16px', height: '16px' }"
              strokeWidth="4"
              styleClass="inline-block mr-1"
            />
            Sending...
          } @else {
            <i class="pi pi-send mr-1"></i>
            Send
          }
        </p-button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      textarea {
        font-family: inherit;
      }
    `,
  ],
})
export class CommentInputComponent implements OnDestroy {
  private commentService = inject(CommentService);
  private overlay = inject(Overlay);
  private destroy$ = new Subject<void>();

  taskId = input.required<string>();
  workspaceId = input.required<string>();
  parentId = input<string>();

  commentCreated = output<Comment>();

  textareaRef =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('textareaRef');

  content = '';
  isSubmitting = signal(false);

  private overlayRef: OverlayRef | null = null;
  private mentionStartIndex: number | null = null;
  private mentionSearchQuery = signal('');

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.closeMentionPopover();
  }

  onInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = this.content.substring(0, cursorPosition);

    // Check for @ character to trigger mention popover
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if the @ is at start or preceded by whitespace
      const charBeforeAt =
        lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      const isValidMentionStart = /\s/.test(charBeforeAt) || lastAtIndex === 0;

      // Check if there's no space between @ and cursor
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const hasNoSpace = !textAfterAt.includes(' ');

      if (isValidMentionStart && hasNoSpace) {
        this.mentionStartIndex = lastAtIndex;
        this.mentionSearchQuery.set(textAfterAt);
        this.openMentionPopover();
        return;
      }
    }

    // Close popover if no valid mention detected
    if (this.overlayRef) {
      this.closeMentionPopover();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.overlayRef) return;

    // Pass keyboard events to the popover
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeMentionPopover();
      }
      // For arrow keys and Enter, the popover handles the event
    }
  }

  onBlur(): void {
    // Delay closing to allow click events on the popover
    setTimeout(() => {
      if (this.overlayRef) {
        this.closeMentionPopover();
      }
    }, 200);
  }

  submitComment(): void {
    const trimmedContent = this.content.trim();
    if (!trimmedContent || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    this.commentService
      .create(this.taskId(), trimmedContent, this.parentId())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (comment) => {
          this.content = '';
          this.isSubmitting.set(false);
          this.commentCreated.emit(comment);
        },
        error: (error) => {
          console.error('Failed to create comment:', error);
          this.isSubmitting.set(false);
        },
      });
  }

  private openMentionPopover(): void {
    if (this.overlayRef) {
      // Already open, just update search query
      return;
    }

    const textarea = this.textareaRef().nativeElement;

    // Create overlay positioned below the textarea
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(textarea)
      .withPositions([
        {
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top',
          offsetY: 4,
        },
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -4,
        },
      ]);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close(),
      hasBackdrop: false,
      width: 320,
    });

    const portal = new ComponentPortal(MentionPopoverComponent);
    const componentRef = this.overlayRef.attach(portal);

    // Set inputs using setInput (Angular 17.1+)
    componentRef.setInput('searchQuery', this.mentionSearchQuery());
    componentRef.setInput('workspaceId', this.workspaceId());

    // Keep searchQuery in sync
    const searchEffect = setInterval(() => {
      if (componentRef.instance) {
        componentRef.setInput('searchQuery', this.mentionSearchQuery());
      }
    }, 50);

    // Handle member selection
    componentRef.instance.memberSelected.subscribe(
      (member: MemberSelectedEvent) => {
        this.insertMention(member);
        this.closeMentionPopover();
      },
    );

    // Cleanup interval on destroy
    this.overlayRef.detachments().subscribe(() => {
      clearInterval(searchEffect);
    });
  }

  private closeMentionPopover(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
      this.mentionStartIndex = null;
      this.mentionSearchQuery.set('');
    }
  }

  private insertMention(member: MemberSelectedEvent): void {
    if (this.mentionStartIndex === null) return;

    const textarea = this.textareaRef().nativeElement;
    const cursorPosition = textarea.selectionStart;

    // Replace @query with @[name](id)
    const beforeMention = this.content.substring(0, this.mentionStartIndex);
    const afterMention = this.content.substring(cursorPosition);
    const mentionText = `@[${member.name}](${member.id}) `;

    this.content = beforeMention + mentionText + afterMention;

    // Set cursor position after the mention
    const newCursorPos = beforeMention.length + mentionText.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }
}

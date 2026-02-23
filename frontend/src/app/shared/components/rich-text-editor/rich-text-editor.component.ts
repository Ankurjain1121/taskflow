import {
  Component,
  input,
  output,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rich-text-editor border border-[var(--border)] rounded-md overflow-hidden"
    >
      <!-- Toolbar -->
      @if (!readonly()) {
        <div
          class="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--muted)]"
        >
          <button
            type="button"
            (click)="toggleBold()"
            class="toolbar-btn"
            [class.active]="editor?.isActive('bold')"
            title="Bold (Ctrl+B)"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"
              />
            </svg>
          </button>
          <button
            type="button"
            (click)="toggleItalic()"
            class="toolbar-btn"
            [class.active]="editor?.isActive('italic')"
            title="Italic (Ctrl+I)"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
            </svg>
          </button>
          <button
            type="button"
            (click)="toggleUnderline()"
            class="toolbar-btn"
            [class.active]="editor?.isActive('underline')"
            title="Underline (Ctrl+U)"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"
              />
            </svg>
          </button>
          <button
            type="button"
            (click)="toggleStrike()"
            class="toolbar-btn"
            [class.active]="editor?.isActive('strike')"
            title="Strikethrough"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"
              />
            </svg>
          </button>

          <div class="w-px h-5 bg-[var(--border)] mx-1"></div>

          <button
            type="button"
            (click)="toggleBulletList()"
            class="toolbar-btn"
            [class.active]="editor?.isActive('bulletList')"
            title="Bullet List"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
              />
            </svg>
          </button>
          <button
            type="button"
            (click)="toggleOrderedList()"
            class="toolbar-btn"
            [class.active]="editor?.isActive('orderedList')"
            title="Numbered List"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"
              />
            </svg>
          </button>

          <div class="w-px h-5 bg-[var(--border)] mx-1"></div>

          <button
            type="button"
            (click)="toggleCode()"
            class="toolbar-btn"
            [class.active]="editor?.isActive('code')"
            title="Inline Code"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </button>
          <button
            type="button"
            (click)="toggleBlockquote()"
            class="toolbar-btn"
            [class.active]="editor?.isActive('blockquote')"
            title="Quote"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
            </svg>
          </button>

          @if (!compact()) {
            <div class="w-px h-5 bg-[var(--border)] mx-1"></div>

            <button
              type="button"
              (click)="toggleHeading(1)"
              class="toolbar-btn text-xs font-bold"
              [class.active]="editor?.isActive('heading', { level: 1 })"
              title="Heading 1"
            >
              H1
            </button>
            <button
              type="button"
              (click)="toggleHeading(2)"
              class="toolbar-btn text-xs font-bold"
              [class.active]="editor?.isActive('heading', { level: 2 })"
              title="Heading 2"
            >
              H2
            </button>
            <button
              type="button"
              (click)="toggleHeading(3)"
              class="toolbar-btn text-xs font-bold"
              [class.active]="editor?.isActive('heading', { level: 3 })"
              title="Heading 3"
            >
              H3
            </button>
          }

          <div class="w-px h-5 bg-[var(--border)] mx-1"></div>

          <button
            type="button"
            (click)="toggleLink()"
            class="toolbar-btn"
            [class.active]="editor?.isActive('link')"
            title="Link"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </button>
        </div>
      }

      <!-- Editor Content -->
      <div #editorEl class="prose-editor" [class.readonly]="readonly()"></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .toolbar-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 4px;
        color: var(--muted-foreground);
        transition: all 0.1s ease;
      }

      .toolbar-btn:hover {
        background: var(--secondary);
        color: var(--foreground);
      }

      .toolbar-btn.active {
        background: var(--primary);
        color: var(--primary-foreground);
      }

      .prose-editor {
        min-height: 100px;
        padding: 12px;
        color: var(--foreground);
        font-size: 14px;
        line-height: 1.6;
      }

      .prose-editor.readonly {
        min-height: auto;
        padding: 0;
      }

      :host ::ng-deep .tiptap {
        outline: none;
      }

      :host ::ng-deep .tiptap p {
        margin: 0 0 0.5em;
      }

      :host ::ng-deep .tiptap p:last-child {
        margin-bottom: 0;
      }

      :host ::ng-deep .tiptap ul,
      :host ::ng-deep .tiptap ol {
        padding-left: 1.5em;
        margin: 0.5em 0;
      }

      :host ::ng-deep .tiptap li {
        margin: 0.25em 0;
      }

      :host ::ng-deep .tiptap code {
        background: var(--muted);
        padding: 0.15em 0.4em;
        border-radius: 4px;
        font-size: 0.9em;
        font-family: 'JetBrains Mono', monospace;
      }

      :host ::ng-deep .tiptap pre {
        background: var(--muted);
        border-radius: 6px;
        padding: 12px;
        margin: 0.5em 0;
        overflow-x: auto;
      }

      :host ::ng-deep .tiptap pre code {
        background: none;
        padding: 0;
      }

      :host ::ng-deep .tiptap blockquote {
        border-left: 3px solid var(--border);
        padding-left: 1em;
        margin: 0.5em 0;
        color: var(--muted-foreground);
      }

      :host ::ng-deep .tiptap h1 {
        font-size: 1.5em;
        font-weight: 700;
        margin: 0.5em 0 0.25em;
      }

      :host ::ng-deep .tiptap h2 {
        font-size: 1.25em;
        font-weight: 600;
        margin: 0.5em 0 0.25em;
      }

      :host ::ng-deep .tiptap h3 {
        font-size: 1.1em;
        font-weight: 600;
        margin: 0.5em 0 0.25em;
      }

      :host ::ng-deep .tiptap strong {
        font-weight: 600;
      }

      :host ::ng-deep .tiptap a {
        color: var(--primary);
        text-decoration: underline;
      }

      :host ::ng-deep .tiptap .is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        float: left;
        color: var(--muted-foreground);
        pointer-events: none;
        height: 0;
      }
    `,
  ],
})
export class RichTextEditorComponent implements OnInit, OnDestroy {
  content = input<string>('');
  placeholder = input<string>('Write something...');
  readonly = input<boolean>(false);
  compact = input<boolean>(false);
  minHeight = input<string>('100px');

  contentChanged = output<string>();

  @ViewChild('editorEl', { static: true })
  editorEl!: ElementRef<HTMLDivElement>;

  editor: Editor | null = null;
  private skipNextUpdate = false;

  constructor() {
    // Sync external content changes
    effect(() => {
      const newContent = this.content();
      if (this.editor && this.skipNextUpdate) {
        this.skipNextUpdate = false;
        return;
      }
      if (this.editor && newContent !== this.editor.getHTML()) {
        this.editor.commands.setContent(newContent || '', {
          emitUpdate: false,
        });
      }
    });
  }

  ngOnInit(): void {
    this.editor = new Editor({
      element: this.editorEl.nativeElement,
      extensions: [
        StarterKit,
        Underline,
        Placeholder.configure({
          placeholder: this.placeholder(),
        }),
        Link.configure({
          openOnClick: true,
          autolink: true,
        }),
      ],
      content: this.content() || '',
      editable: !this.readonly(),
      onUpdate: ({ editor }) => {
        this.skipNextUpdate = true;
        const html = editor.getHTML();
        this.contentChanged.emit(html === '<p></p>' ? '' : html);
      },
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  toggleUnderline(): void {
    this.editor?.chain().focus().toggleUnderline().run();
  }

  toggleStrike(): void {
    this.editor?.chain().focus().toggleStrike().run();
  }

  toggleBulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  toggleOrderedList(): void {
    this.editor?.chain().focus().toggleOrderedList().run();
  }

  toggleCode(): void {
    this.editor?.chain().focus().toggleCode().run();
  }

  toggleBlockquote(): void {
    this.editor?.chain().focus().toggleBlockquote().run();
  }

  toggleHeading(level: 1 | 2 | 3): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  toggleLink(): void {
    if (this.editor?.isActive('link')) {
      this.editor.chain().focus().unsetLink().run();
      return;
    }

    const url = window.prompt('Enter URL:');
    if (url) {
      this.editor?.chain().focus().setLink({ href: url }).run();
    }
  }
}

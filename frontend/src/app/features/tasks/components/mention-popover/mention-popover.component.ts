import {
  Component,
  input,
  output,
  signal,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  of,
  catchError,
} from 'rxjs';

export interface MentionableMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string;
}

export interface MemberSelectedEvent {
  id: string;
  name: string;
}

@Component({
  selector: 'app-mention-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ProgressSpinnerModule],
  template: `
    <div
      class="bg-[var(--card)] rounded-lg shadow-lg border border-[var(--border)] max-h-64 overflow-y-auto min-w-64"
      role="listbox"
      [attr.aria-label]="'Member suggestions'"
    >
      @if (isLoading()) {
        <div class="flex items-center justify-center p-4">
          <p-progressSpinner
            [style]="{ width: '24px', height: '24px' }"
            strokeWidth="4"
          />
          <span class="ml-2 text-sm text-[var(--muted-foreground)]"
            >Searching...</span
          >
        </div>
      } @else if (members().length === 0) {
        <div class="p-4 text-sm text-[var(--muted-foreground)] text-center">
          @if (searchQuery().length > 0) {
            No members found matching "{{ searchQuery() }}"
          } @else {
            Type to search for members
          }
        </div>
      } @else {
        <div class="py-1">
          @for (member of members(); track member.id; let i = $index) {
            <div
              (click)="selectMember(member)"
              [style.background]="
                i === selectedIndex()
                  ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
                  : ''
              "
              class="cursor-pointer hover:bg-[var(--muted)] px-3 py-2"
              role="option"
              [attr.aria-selected]="i === selectedIndex()"
            >
              <div class="flex items-center gap-3">
                @if (member.avatar_url) {
                  <img
                    [src]="member.avatar_url"
                    [alt]="member.display_name"
                    class="w-8 h-8 rounded-full object-cover"
                  />
                } @else {
                  <div
                    class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium"
                  >
                    {{ getInitials(member.display_name) }}
                  </div>
                }
                <div class="flex flex-col min-w-0">
                  <span
                    class="text-sm font-medium text-[var(--card-foreground)] truncate"
                  >
                    {{ member.display_name }}
                  </span>
                  <span class="text-xs text-[var(--muted-foreground)] truncate">
                    {{ member.email }}
                  </span>
                </div>
              </div>
            </div>
          }
        </div>
      }
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
export class MentionPopoverComponent implements OnDestroy {
  private http = inject(HttpClient);
  private elementRef = inject(ElementRef);
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  searchQuery = input.required<string>();
  workspaceId = input.required<string>();

  memberSelected = output<MemberSelectedEvent>();

  members = signal<MentionableMember[]>([]);
  isLoading = signal(false);
  selectedIndex = signal(0);

  constructor() {
    // Set up debounced search
    this.searchSubject$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.length === 0) {
            return of([]);
          }
          this.isLoading.set(true);
          return this.searchMembers(query).pipe(
            catchError(() => {
              return of([]);
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((results) => {
        this.members.set(results);
        this.selectedIndex.set(0);
        this.isLoading.set(false);
      });

    // React to search query changes
    effect(() => {
      const query = this.searchQuery();
      this.searchSubject$.next(query);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    const membersList = this.members();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (this.selectedIndex() < membersList.length - 1) {
          this.selectedIndex.update((i) => i + 1);
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (this.selectedIndex() > 0) {
          this.selectedIndex.update((i) => i - 1);
        }
        break;

      case 'Enter':
        event.preventDefault();
        if (membersList.length > 0) {
          this.selectMember(membersList[this.selectedIndex()]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        // Parent component should handle closing
        break;
    }
  }

  selectMember(member: MentionableMember): void {
    this.memberSelected.emit({
      id: member.id,
      name: member.display_name,
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  private searchMembers(query: string) {
    return this.http.get<MentionableMember[]>(
      `/api/workspaces/${this.workspaceId()}/members/search`,
      { params: { search: query } },
    );
  }
}

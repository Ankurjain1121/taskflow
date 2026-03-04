import {
  Component,
  input,
  output,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoardMember } from '../../../../../core/services/board.service';

@Component({
  selector: 'app-assignee-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-2">
      <input
        type="text"
        [(ngModel)]="searchQuery"
        placeholder="Search members..."
        class="w-full px-2 py-1.5 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] mb-2"
      />
      <div
        class="max-h-48 overflow-y-auto space-y-0.5"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Assignees"
      >
        @for (member of filteredMembers(); track member.user_id) {
          <button
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors hover:bg-[var(--muted)]"
            role="option"
            [attr.aria-selected]="isSelected(member.user_id)"
            (click)="toggle(member.user_id)"
          >
            <!-- Avatar -->
            <div
              class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
              [style.background]="
                member.avatar_url ? 'transparent' : getGradient(member.user_id)
              "
            >
              @if (member.avatar_url) {
                <img
                  [src]="member.avatar_url"
                  [alt]="getMemberName(member)"
                  class="w-full h-full object-cover"
                />
              } @else {
                {{ getInitials(getMemberName(member)) }}
              }
            </div>
            <span class="flex-1 text-left text-[var(--foreground)] truncate">
              {{ getMemberName(member) }}
            </span>
            @if (isSelected(member.user_id)) {
              <svg
                class="w-4 h-4 flex-shrink-0"
                style="color: var(--primary)"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            }
          </button>
        }
        @if (filteredMembers().length === 0) {
          <p
            class="text-xs text-[var(--muted-foreground)] px-2 py-3 text-center"
          >
            No members found
          </p>
        }
      </div>
    </div>
  `,
})
export class AssigneePickerComponent implements OnInit {
  members = input<BoardMember[]>([]);
  selectedIds = input<string[]>([]);
  assigneesChanged = output<string[]>();

  searchQuery = '';
  private selected = signal<Set<string>>(new Set());

  filteredMembers = computed(() => {
    const q = this.searchQuery.toLowerCase();
    const all = this.members();
    if (!q) return all;
    return all.filter((m) => {
      const name = this.getMemberName(m).toLowerCase();
      const email = (m.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  });

  ngOnInit(): void {
    this.selected.set(new Set(this.selectedIds()));
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  toggle(id: string): void {
    const current = new Set(this.selected());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selected.set(current);
    this.assigneesChanged.emit([...current]);
  }

  getMemberName(member: BoardMember): string {
    return member.name || member.email || 'Unknown';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getGradient(id: string): string {
    const gradients = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #3b82f6, #06b6d4)',
      'linear-gradient(135deg, #f59e0b, #ef4444)',
      'linear-gradient(135deg, #10b981, #14b8a6)',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
    }
    return gradients[Math.abs(hash) % gradients.length];
  }
}

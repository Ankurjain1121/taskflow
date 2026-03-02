import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tooltip } from 'primeng/tooltip';
import { PresenceService } from '../../../core/services/presence.service';
import { AuthService } from '../../../core/services/auth.service';
import { BoardStateService } from '../../../features/board/board-view/board-state.service';

interface ViewerDisplay {
  userId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

@Component({
  selector: 'app-board-presence',
  standalone: true,
  imports: [CommonModule, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visibleViewers().length > 0) {
      <div class="flex items-center">
        <div class="flex -space-x-2">
          @for (viewer of visibleViewers().slice(0, 5); track viewer.userId; let i = $index) {
            <div
              class="w-8 h-8 rounded-full ring-2 ring-[var(--card)] flex items-center justify-center text-xs font-bold text-white shadow-sm cursor-default"
              [style.z-index]="10 - i"
              [style.background]="viewer.avatarUrl ? 'transparent' : getGradient(i)"
              [pTooltip]="viewer.name"
              tooltipPosition="bottom"
            >
              @if (viewer.avatarUrl) {
                <img
                  [src]="viewer.avatarUrl"
                  [alt]="viewer.name"
                  class="w-full h-full rounded-full object-cover"
                />
              } @else {
                {{ viewer.initials }}
              }
            </div>
          }
          @if (overflowCount() > 0) {
            <div
              class="w-8 h-8 rounded-full ring-2 ring-[var(--card)] bg-[var(--secondary)] flex items-center justify-center text-xs font-bold text-[var(--muted-foreground)] shadow-sm cursor-default"
              [style.z-index]="5"
              [pTooltip]="overflowTooltip()"
              tooltipPosition="bottom"
            >
              +{{ overflowCount() }}
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class BoardPresenceComponent {
  private presenceService = inject(PresenceService);
  private authService = inject(AuthService);
  private boardState = inject(BoardStateService);

  private readonly gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  ];

  readonly visibleViewers = computed((): ViewerDisplay[] => {
    const currentUserId = this.authService.currentUser()?.id;
    const viewerIds = this.presenceService.boardViewers();
    const members = this.boardState.boardMembers();
    const viewerNameMap = this.presenceService.viewerNames();

    return viewerIds
      .filter((id) => id !== currentUserId)
      .map((userId) => {
        const member = members.find((m) => m.user_id === userId);
        const name =
          member?.name ||
          viewerNameMap.get(userId) ||
          member?.email ||
          'Unknown';
        return {
          userId,
          name,
          initials: this.getInitials(name),
          avatarUrl: member?.avatar_url ?? null,
        };
      });
  });

  readonly overflowCount = computed(() => {
    const total = this.visibleViewers().length;
    return total > 5 ? total - 5 : 0;
  });

  readonly overflowTooltip = computed(() => {
    const overflow = this.visibleViewers().slice(5);
    return overflow.map((v) => v.name).join(', ');
  });

  getGradient(index: number): string {
    return this.gradients[index % this.gradients.length];
  }

  private getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (name[0] || '?').toUpperCase();
  }
}

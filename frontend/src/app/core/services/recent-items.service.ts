import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';

export interface RecentItem {
  id: string;
  entityType: 'board' | 'task';
  name: string;
  context: string; // e.g. "Workspace > Board" for tasks, "Workspace" for boards
  workspaceId: string;
  boardId?: string; // for tasks
  visitedAt: number;
}

const STORAGE_KEY = 'taskbolt_recent_items';
const BOARDS_STORAGE_KEY = 'taskbolt_recent_boards'; // shared with sidebar-recent
const MAX_ITEMS = 10;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable({ providedIn: 'root' })
export class RecentItemsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';

  readonly items = signal<RecentItem[]>([]);

  readonly recentBoards = computed(() =>
    this.items().filter((i) => i.entityType === 'board'),
  );

  readonly recentTasks = computed(() =>
    this.items().filter((i) => i.entityType === 'task'),
  );

  constructor() {
    this.loadFromStorage();
  }

  recordBoardView(board: {
    id: string;
    name: string;
    workspaceId: string;
    workspaceName?: string;
  }): void {
    const entry: RecentItem = {
      id: board.id,
      entityType: 'board',
      name: board.name,
      context: board.workspaceName ?? '',
      workspaceId: board.workspaceId,
      visitedAt: Date.now(),
    };
    this.addItem(entry);
    this.postToServer('board', board.id);
  }

  recordTaskView(task: {
    id: string;
    title: string;
    boardName: string;
    workspaceId: string;
    workspaceName?: string;
    boardId: string;
  }): void {
    const entry: RecentItem = {
      id: task.id,
      entityType: 'task',
      name: task.title,
      context: task.workspaceName
        ? `${task.workspaceName} > ${task.boardName}`
        : task.boardName,
      workspaceId: task.workspaceId,
      boardId: task.boardId,
      visitedAt: Date.now(),
    };
    this.addItem(entry);
    this.postToServer('task', task.id);
  }

  getForPalette(): RecentItem[] {
    return this.items().slice(0, MAX_ITEMS);
  }

  private addItem(entry: RecentItem): void {
    const current = this.items().filter(
      (i) => !(i.id === entry.id && i.entityType === entry.entityType),
    );
    const updated = [entry, ...current].slice(0, MAX_ITEMS);
    this.items.set(updated);
    this.saveToStorage(updated);
  }

  private loadFromStorage(): void {
    try {
      // Load recent items
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const items: RecentItem[] = JSON.parse(raw);
        const now = Date.now();
        const valid = items.filter((i) => now - i.visitedAt < TTL_MS);
        this.items.set(valid.slice(0, MAX_ITEMS));
        return;
      }

      // Fallback: seed from sidebar-recent boards if no recent items yet
      const boardsRaw = localStorage.getItem(BOARDS_STORAGE_KEY);
      if (boardsRaw) {
        const boards = JSON.parse(boardsRaw) as Array<{
          id: string;
          name: string;
          workspaceId: string;
          visitedAt: number;
        }>;
        const now = Date.now();
        const seeded: RecentItem[] = boards
          .filter((b) => now - b.visitedAt < TTL_MS)
          .map((b) => ({
            id: b.id,
            entityType: 'board' as const,
            name: b.name,
            context: '',
            workspaceId: b.workspaceId,
            visitedAt: b.visitedAt,
          }));
        this.items.set(seeded.slice(0, MAX_ITEMS));
        this.saveToStorage(seeded.slice(0, MAX_ITEMS));
      }
    } catch {
      // Corrupted localStorage
    }
  }

  private saveToStorage(items: RecentItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage full or unavailable
    }
  }

  private postToServer(entityType: string, entityId: string): void {
    this.http
      .post(`${this.apiUrl}/recent-items`, {
        entity_type: entityType,
        entity_id: entityId,
      })
      .subscribe({
        error: () => {
          // Server-side tracking is best-effort
        },
      });
  }
}

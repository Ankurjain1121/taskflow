/**
 * WorkspaceContextService — manages active workspace state
 *
 * State sync priority:
 *   URL params -> localStorage -> first workspace -> create prompt
 *
 *   +------+     +-------------+     +-----------+
 *   | URL  |---->| activeWsId  |---->| Sidebar   |
 *   +------+     |  (signal)   |     | Projects  |
 *   +------+     |             |     | Views     |
 *   | LS   |---->|             |---->| Breadcrumb|
 *   +------+     +-------------+     +-----------+
 *                      |
 *                      v
 *               localStorage persist
 */
import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Subject, switchMap, retry, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WorkspaceService, Workspace } from './workspace.service';
import { ProjectService, Board } from './project.service';

const LS_ACTIVE_WS = 'taskflow_active_ws';
const LS_PROJECT_COLORS = 'taskflow_project_colors';
const LS_PROJECT_ORDER_PREFIX = 'taskflow_project_order_';

const ACCENT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
] as const;

const WS_COLORS = ACCENT_COLORS;

@Injectable({ providedIn: 'root' })
export class WorkspaceContextService {
  private readonly router = inject(Router);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly projectService = inject(ProjectService);

  // --- Core state ---
  readonly workspaces = signal<Workspace[]>([]);
  readonly activeWorkspaceId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly initialized = signal(false);

  // --- Project cache: wsId -> Board[] ---
  private readonly projectCache = new Map<string, Board[]>();
  readonly activeProjects = signal<Board[]>([]);

  // --- Derived state ---
  readonly activeWorkspace = computed(() => {
    const id = this.activeWorkspaceId();
    return this.workspaces().find((ws) => ws.id === id) ?? null;
  });

  // --- Workspace switching trigger ---
  private readonly switchSubject = new Subject<string>();

  constructor() {
    this.switchSubject
      .pipe(
        takeUntilDestroyed(),
        switchMap((wsId) => {
          const cached = this.projectCache.get(wsId);
          if (cached) {
            this.activeProjects.set(cached);
            return of(cached);
          }
          this.loading.set(true);
          this.error.set(null);
          return this.projectService.listBoards(wsId).pipe(
            retry(1),
            catchError((err) => {
              this.error.set('Failed to load projects');
              this.loading.set(false);
              return of([] as Board[]);
            }),
          );
        }),
      )
      .subscribe((boards) => {
        const wsId = this.activeWorkspaceId();
        if (wsId) {
          this.projectCache.set(wsId, boards);
        }
        this.activeProjects.set(boards);
        this.loading.set(false);
      });
  }

  private _initPromise: Promise<void> | null = null;

  /** Load all workspaces and resolve initial active workspace. Idempotent. */
  async init(urlWorkspaceId?: string): Promise<void> {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit(urlWorkspaceId);
    return this._initPromise;
  }

  private async _doInit(urlWorkspaceId?: string): Promise<void> {
    try {
      const list = await firstValueFrom(this.workspaceService.list());
      this.workspaces.set(list);
      if (list.length === 0) return;

      const resolved =
        (urlWorkspaceId && list.find((w) => w.id === urlWorkspaceId)?.id) ||
        this.readStoredWsId(list) ||
        list[0].id;

      this.setActive(resolved);
    } catch {
      this.error.set('Failed to load workspaces');
    } finally {
      this.initialized.set(true);
    }
  }

  /** Returns a promise that resolves when init() completes. */
  whenReady(): Promise<void> {
    if (this.initialized()) return Promise.resolve();
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (this.initialized()) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });
  }

  /** Switch active workspace and navigate. */
  switchWorkspace(wsId: string): void {
    this.setActive(wsId);
    this.router.navigate(['/workspace', wsId]);
  }

  /** Set active workspace from URL navigation (no re-navigate). */
  syncFromUrl(wsId: string): void {
    if (wsId !== this.activeWorkspaceId()) {
      this.setActive(wsId);
    }
  }

  /** Invalidate cached projects for a workspace. */
  invalidateProjects(wsId: string): void {
    this.projectCache.delete(wsId);
    if (wsId === this.activeWorkspaceId()) {
      this.switchSubject.next(wsId);
    }
  }

  // --- Project colors ---

  getProjectColor(projectId: string): string {
    const colors = this.readProjectColors();
    const raw = colors[projectId];
    const idx = raw != null ? Number(raw) : NaN;
    return !isNaN(idx) ? ACCENT_COLORS[idx % ACCENT_COLORS.length] : ACCENT_COLORS[0];
  }

  setProjectColor(projectId: string, colorIndex: number): void {
    const colors = { ...this.readProjectColors(), [projectId]: String(colorIndex) };
    this.writeJson(LS_PROJECT_COLORS, colors);
  }

  // --- Project order ---

  getOrderedProjects(): Board[] {
    const wsId = this.activeWorkspaceId();
    if (!wsId) return this.activeProjects();

    const order = this.readProjectOrder(wsId);
    const projects = this.activeProjects();

    if (order.length === 0) return projects;

    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const ordered: Board[] = [];

    for (const id of order) {
      const p = projectMap.get(id);
      if (p) {
        ordered.push(p);
        projectMap.delete(id);
      }
    }
    // Append new projects not yet in the order
    for (const p of projectMap.values()) {
      ordered.push(p);
    }
    return ordered;
  }

  saveProjectOrder(projectIds: string[]): void {
    const wsId = this.activeWorkspaceId();
    if (!wsId) return;
    this.writeJson(`${LS_PROJECT_ORDER_PREFIX}${wsId}`, projectIds);
  }

  // --- Workspace color helper ---

  getWorkspaceColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return WS_COLORS[Math.abs(hash) % WS_COLORS.length];
  }

  // --- Private helpers ---

  private setActive(wsId: string): void {
    this.activeWorkspaceId.set(wsId);
    this.persistWsId(wsId);
    this.switchSubject.next(wsId);
  }

  private persistWsId(wsId: string): void {
    try {
      localStorage.setItem(LS_ACTIVE_WS, wsId);
    } catch { /* quota exceeded — ignore */ }
  }

  private readStoredWsId(available: Workspace[]): string | null {
    try {
      const stored = localStorage.getItem(LS_ACTIVE_WS);
      if (stored && available.some((w) => w.id === stored)) return stored;
    } catch { /* corrupted — ignore */ }
    return null;
  }

  private readProjectColors(): Record<string, string> {
    try {
      const raw = localStorage.getItem(LS_PROJECT_COLORS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private readProjectOrder(wsId: string): string[] {
    try {
      const raw = localStorage.getItem(`${LS_PROJECT_ORDER_PREFIX}${wsId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeJson(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota exceeded — ignore */ }
  }
}

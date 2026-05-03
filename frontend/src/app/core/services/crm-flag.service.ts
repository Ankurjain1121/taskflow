import { Injectable, inject, computed } from '@angular/core';
import { WorkspaceContextService } from './workspace-context.service';

const LS_PREFIX = 'taskbolt_crm_enabled_';

@Injectable({ providedIn: 'root' })
export class CrmFlagService {
  private readonly ctx = inject(WorkspaceContextService);

  /** True when crm_enabled is set for the active workspace. Defaults to false. */
  readonly crmEnabled = computed<boolean>(() => {
    const wsId = this.ctx.activeWorkspaceId();
    if (!wsId) return false;
    try {
      return localStorage.getItem(`${LS_PREFIX}${wsId}`) === 'true';
    } catch {
      return false;
    }
  });

  enable(wsId: string): void {
    try { localStorage.setItem(`${LS_PREFIX}${wsId}`, 'true'); } catch { /* quota */ }
  }

  disable(wsId: string): void {
    try { localStorage.removeItem(`${LS_PREFIX}${wsId}`); } catch { /* quota */ }
  }
}

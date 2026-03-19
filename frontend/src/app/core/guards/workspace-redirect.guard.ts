import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { WorkspaceContextService } from '../services/workspace-context.service';

/**
 * Creates a guard that redirects old global routes to workspace-scoped equivalents.
 *
 * Usage:
 *   { path: 'dashboard', canActivate: [workspaceRedirectGuard('dashboard')], children: [] }
 *
 * If the user has an active workspace, redirects to /workspace/:wsId/:targetPath.
 * If no workspace is available after initialization, redirects to /discover.
 */
export const workspaceRedirectGuard = (targetPath: string): CanActivateFn => {
  return async () => {
    const router = inject(Router);
    const wsContext = inject(WorkspaceContextService);

    // Wait for workspace context to finish loading before deciding
    await wsContext.whenReady();

    const wsId = wsContext.activeWorkspaceId();
    if (wsId) {
      return router.createUrlTree(['/workspace', wsId, targetPath]);
    }
    return router.createUrlTree(['/discover']);
  };
};

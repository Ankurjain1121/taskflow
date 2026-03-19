import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { WorkspaceContextService } from '../services/workspace-context.service';

/**
 * Creates a guard that redirects old global routes to workspace-scoped equivalents.
 *
 * If the user has an active workspace, redirects to /workspace/:wsId/:targetPath.
 * If workspace context hasn't loaded yet, triggers init and waits (max 5s).
 * If no workspace is available after initialization, redirects to /discover.
 */
export const workspaceRedirectGuard = (targetPath: string): CanActivateFn => {
  return async () => {
    const router = inject(Router);
    const wsContext = inject(WorkspaceContextService);

    // If already initialized, use the active workspace immediately
    if (wsContext.initialized()) {
      const wsId = wsContext.activeWorkspaceId();
      if (wsId) {
        return router.createUrlTree(['/workspace', wsId, targetPath]);
      }
      return router.createUrlTree(['/discover']);
    }

    // Not yet initialized — trigger init and wait with timeout
    try {
      await Promise.race([
        wsContext.init(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000),
        ),
      ]);
    } catch {
      // Timeout or error — fall through to check whatever state we have
    }

    const wsId = wsContext.activeWorkspaceId();
    if (wsId) {
      return router.createUrlTree(['/workspace', wsId, targetPath]);
    }
    return router.createUrlTree(['/discover']);
  };
};

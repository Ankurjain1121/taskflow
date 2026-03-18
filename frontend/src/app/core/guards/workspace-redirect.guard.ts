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
 * If no workspace is available, redirects to /discover.
 */
export const workspaceRedirectGuard = (targetPath: string): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const wsContext = inject(WorkspaceContextService);
    const wsId = wsContext.activeWorkspaceId();
    if (wsId) {
      return router.createUrlTree(['/workspace', wsId, targetPath]);
    }
    // No workspace yet — go to discover page
    return router.createUrlTree(['/discover']);
  };
};

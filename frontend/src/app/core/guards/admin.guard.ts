import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();

  if (!user) {
    return router.createUrlTree(['/auth/sign-in']);
  }

  // Check if user has admin role
  if (user.role === 'Admin') {
    return true;
  }

  // Non-admin users are redirected to dashboard
  return router.createUrlTree(['/dashboard']);
};

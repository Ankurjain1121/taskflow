import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { authGuard, publicOnlyGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('auth guards', () => {
  let mockAuthService: { isAuthenticated: ReturnType<typeof vi.fn> };
  let mockRouter: {
    createUrlTree: ReturnType<typeof vi.fn>;
  };

  const mockRoute: ActivatedRouteSnapshot = {} as ActivatedRouteSnapshot;

  function createMockState(url: string): RouterStateSnapshot {
    return { url } as RouterStateSnapshot;
  }

  const fakeUrlTree = {} as UrlTree;

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: vi.fn(),
    };

    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue(fakeUrlTree),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  describe('authGuard', () => {
    it('should return true when user is authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, createMockState('/dashboard/projects')),
      );

      expect(result).toBe(true);
    });

    it('should not call router.createUrlTree when authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(true);

      TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, createMockState('/dashboard')),
      );

      expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
    });

    it('should redirect to /auth/sign-in when not authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, createMockState('/dashboard/projects')),
      );

      expect(result).toBe(fakeUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/auth/sign-in'], {
        queryParams: { returnUrl: '/dashboard/projects' },
      });
    });

    it('should pass the current URL as returnUrl query param', () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, createMockState('/projects/123/tasks')),
      );

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/auth/sign-in'], {
        queryParams: { returnUrl: '/projects/123/tasks' },
      });
    });

    it('should handle root URL redirect', () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, createMockState('/')),
      );

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/auth/sign-in'], {
        queryParams: { returnUrl: '/' },
      });
    });
  });

  describe('publicOnlyGuard', () => {
    it('should return true when user is NOT authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        publicOnlyGuard(mockRoute, createMockState('/auth/sign-in')),
      );

      expect(result).toBe(true);
    });

    it('should not call router.createUrlTree when not authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      TestBed.runInInjectionContext(() =>
        publicOnlyGuard(mockRoute, createMockState('/auth/sign-in')),
      );

      expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
    });

    it('should redirect to /dashboard when user IS authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() =>
        publicOnlyGuard(mockRoute, createMockState('/auth/sign-in')),
      );

      expect(result).toBe(fakeUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should redirect authenticated user regardless of current public URL', () => {
      mockAuthService.isAuthenticated.mockReturnValue(true);

      TestBed.runInInjectionContext(() =>
        publicOnlyGuard(mockRoute, createMockState('/auth/sign-up')),
      );

      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard, publicOnlyGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('auth guards', () => {
  let mockAuthService: { isAuthenticated: ReturnType<typeof vi.fn> };
  let router: Router;

  const mockRoute = {} as any;
  const mockState = { url: '/dashboard/boards' } as any;

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: string[], extras?: any) => {
              return { commands, extras } as unknown as UrlTree;
            },
          },
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    it('should return true when user is authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
    });

    it('should return UrlTree to /auth/sign-in when not authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, mockState),
      );

      expect(result).not.toBe(true);
      // Result should be a UrlTree (our mock returns an object with commands)
      const tree = result as unknown as { commands: string[]; extras: any };
      expect(tree.commands).toEqual(['/auth/sign-in']);
      expect(tree.extras.queryParams.returnUrl).toBe('/dashboard/boards');
    });
  });

  describe('publicOnlyGuard', () => {
    it('should return true when user is NOT authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(false);

      const result = TestBed.runInInjectionContext(() =>
        publicOnlyGuard(mockRoute, mockState),
      );

      expect(result).toBe(true);
    });

    it('should return UrlTree to /dashboard when user IS authenticated', () => {
      mockAuthService.isAuthenticated.mockReturnValue(true);

      const result = TestBed.runInInjectionContext(() =>
        publicOnlyGuard(mockRoute, mockState),
      );

      expect(result).not.toBe(true);
      const tree = result as unknown as { commands: string[] };
      expect(tree.commands).toEqual(['/dashboard']);
    });
  });
});

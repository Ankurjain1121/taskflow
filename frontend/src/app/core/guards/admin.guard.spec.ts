import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService, User } from '../services/auth.service';

describe('adminGuard', () => {
  let mockAuthService: { currentUser: ReturnType<typeof vi.fn> };
  let mockRouter: { createUrlTree: ReturnType<typeof vi.fn> };

  const mockRoute: ActivatedRouteSnapshot = {} as ActivatedRouteSnapshot;
  const mockState: RouterStateSnapshot = {
    url: '/admin/settings',
  } as RouterStateSnapshot;

  const signInUrlTree = { toString: () => '/auth/sign-in' } as UrlTree;
  const dashboardUrlTree = { toString: () => '/dashboard' } as UrlTree;

  function createUser(overrides: Partial<User> = {}): User {
    return {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: null,
      role: 'Member',
      tenant_id: 'tenant-1',
      onboarding_completed: true,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockAuthService = {
      currentUser: vi.fn(),
    };

    mockRouter = {
      createUrlTree: vi.fn().mockImplementation((commands: string[]) => {
        if (commands[0] === '/auth/sign-in') return signInUrlTree;
        if (commands[0] === '/dashboard') return dashboardUrlTree;
        return {} as UrlTree;
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('should return true when user has Admin role', () => {
    mockAuthService.currentUser.mockReturnValue(
      createUser({ role: 'Admin' }),
    );

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(mockRoute, mockState),
    );

    expect(result).toBe(true);
  });

  it('should not call router.createUrlTree for Admin users', () => {
    mockAuthService.currentUser.mockReturnValue(
      createUser({ role: 'Admin' }),
    );

    TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));

    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect Member to /dashboard', () => {
    mockAuthService.currentUser.mockReturnValue(
      createUser({ role: 'Member' }),
    );

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(mockRoute, mockState),
    );

    expect(result).toBe(dashboardUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should redirect Manager to /dashboard', () => {
    mockAuthService.currentUser.mockReturnValue(
      createUser({ role: 'Manager' }),
    );

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(mockRoute, mockState),
    );

    expect(result).toBe(dashboardUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should redirect to /auth/sign-in when no user (null)', () => {
    mockAuthService.currentUser.mockReturnValue(null);

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(mockRoute, mockState),
    );

    expect(result).toBe(signInUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/auth/sign-in']);
  });

  it('should redirect to /auth/sign-in when currentUser returns undefined', () => {
    mockAuthService.currentUser.mockReturnValue(undefined);

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(mockRoute, mockState),
    );

    expect(result).toBe(signInUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/auth/sign-in']);
  });
});

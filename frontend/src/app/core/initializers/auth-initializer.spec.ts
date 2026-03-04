import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { authInitializerFactory } from './auth-initializer';
import { AuthService } from '../services/auth.service';

describe('authInitializerFactory', () => {
  let mockAuthService: {
    validateSession: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAuthService = {
      validateSession: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    });
  });

  it('should return a function', () => {
    const factory = TestBed.runInInjectionContext(() =>
      authInitializerFactory(),
    );
    expect(typeof factory).toBe('function');
  });

  it('should resolve to true when session is valid', async () => {
    mockAuthService.validateSession.mockReturnValue(of(true));

    const factory = TestBed.runInInjectionContext(() =>
      authInitializerFactory(),
    );
    const result = await factory();

    expect(result).toBe(true);
    expect(mockAuthService.validateSession).toHaveBeenCalledOnce();
  });

  it('should resolve to false when session is invalid', async () => {
    mockAuthService.validateSession.mockReturnValue(of(false));

    const factory = TestBed.runInInjectionContext(() =>
      authInitializerFactory(),
    );
    const result = await factory();

    expect(result).toBe(false);
  });

  it('should reject when validateSession throws', async () => {
    mockAuthService.validateSession.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    const factory = TestBed.runInInjectionContext(() =>
      authInitializerFactory(),
    );

    await expect(factory()).rejects.toThrow('Network error');
  });
});

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  tap,
  catchError,
  throwError,
  of,
  switchMap,
  map,
  timeout,
  shareReplay,
  finalize,
} from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  id: string;
  email: string;
  name: string; // Backend sends 'name', not 'display_name'
  phone_number: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  bio: string | null;
  role: 'SuperAdmin' | 'Admin' | 'Manager' | 'Member'; // Backend uses capitalized role names
  tenant_id: string;
  onboarding_completed: boolean;
  last_login_at: string | null;
}

export interface TokenResponse {
  csrf_token: string;
  user: User;
}

export interface TwoFactorRequiredResponse {
  requires_2fa: true;
  temp_token: string;
}

export type SignInResponse = TokenResponse | TwoFactorRequiredResponse;

export function isTwoFactorRequired(
  response: SignInResponse,
): response is TwoFactorRequiredResponse {
  return 'requires_2fa' in response && response.requires_2fa === true;
}

export interface SignInRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

/** Only non-sensitive flags are persisted — full user comes from /auth/me */
const AUTH_FLAG_KEY = 'taskflow_auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = '/api/auth';
  private _currentUser = signal<User | null>(null);
  private _csrfToken = signal<string | null>(null);
  private _refreshInFlight$: Observable<TokenResponse> | null = null;

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly csrfToken = this._csrfToken.asReadonly();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  /**
   * Validate the current session on app boot.
   * If localStorage has a user but the cookie is invalid, clears state.
   * Called by APP_INITIALIZER before any route guard runs.
   */
  validateSession(): Observable<boolean> {
    const hasSession = this.hasStoredSession();
    if (!hasSession) {
      this._currentUser.set(null);
      return of(false);
    }

    return this.http
      .get<TokenResponse>(`${this.apiUrl}/me`, { withCredentials: true })
      .pipe(
        map((response) => {
          this.handleAuthSuccess(response);
          return true;
        }),
        catchError((meError) =>
          // /me failed — try refreshing the token
          this.http
            .post<TokenResponse>(
              `${this.apiUrl}/refresh`,
              {},
              { withCredentials: true },
            )
            .pipe(
              map((response) => {
                this.handleAuthSuccess(response);
                return true;
              }),
              catchError((refreshError) => {
                // Only clear session if the server explicitly rejected us (4xx).
                // Network errors (status 0) and server errors (5xx) mean the
                // backend is unreachable (e.g. during a deploy or restart) —
                // keep the session flag so the next page load can retry.
                const meStatus = meError?.status ?? 0;
                const refreshStatus = refreshError?.status ?? 0;
                const isClientError = (s: number) => s >= 400 && s < 500;
                if (isClientError(meStatus) || isClientError(refreshStatus)) {
                  this.clearLocalState();
                }
                return of(false);
              }),
            ),
        ),
      );
  }

  signIn(
    email: string,
    password: string,
    rememberMe: boolean = true,
  ): Observable<SignInResponse> {
    return this.http
      .post<SignInResponse>(`${this.apiUrl}/sign-in`, {
        email,
        password,
        remember_me: rememberMe,
      })
      .pipe(
        tap((response) => {
          if (!isTwoFactorRequired(response)) {
            this.handleAuthSuccess(response);
          }
        }),
        catchError((error) => {
          return throwError(() => error);
        }),
      );
  }

  signUp(request: SignUpRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/sign-up`, request)
      .pipe(
        tap((response) => this.handleAuthSuccess(response)),
        catchError((error) => {
          return throwError(() => error);
        }),
      );
  }

  refresh(): Observable<TokenResponse> {
    if (this._refreshInFlight$) {
      return this._refreshInFlight$;
    }

    this._refreshInFlight$ = this.http
      .post<TokenResponse>(
        `${this.apiUrl}/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(
        timeout(10000),
        tap((response) => {
          this.handleAuthSuccess(response);
        }),
        catchError((error) => {
          return throwError(() => error);
        }),
        finalize(() => {
          this._refreshInFlight$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this._refreshInFlight$;
  }

  signOut(reason?: 'expired' | 'manual'): void {
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      error: () => {
        // Ignore errors — clear local state regardless
      },
    });
    this.clearLocalState();

    const queryParams: Record<string, string> = {};
    if (reason === 'expired') {
      queryParams['reason'] = 'session_expired';
    }
    this.router.navigate(['/auth/sign-in'], { queryParams });
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/forgot-password`,
      { email },
    );
  }

  resetPassword(
    token: string,
    newPassword: string,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/reset-password`,
      {
        token,
        new_password: newPassword,
      },
    );
  }

  updateProfile(data: {
    name?: string;
    phone_number?: string | null;
    avatar_url?: string;
    job_title?: string | null;
    department?: string | null;
    bio?: string | null;
  }): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/me`, data).pipe(
      tap((user) => {
        this.storeSessionFlag();
        this._currentUser.set(user);
      }),
    );
  }

  deleteAccount(password: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/me`, {
      body: { password },
    });
  }

  changePassword(data: {
    current_password: string;
    new_password: string;
  }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/change-password`,
      data,
    );
  }

  /** Called after successful 2FA challenge to set auth state */
  handleTwoFactorSuccess(response: TokenResponse): void {
    this.handleAuthSuccess(response);
  }

  private handleAuthSuccess(response: TokenResponse): void {
    this.storeSessionFlag();
    this._currentUser.set(response.user);
    if (response.csrf_token) {
      this._csrfToken.set(response.csrf_token);
    }
  }

  private clearLocalState(): void {
    localStorage.removeItem(AUTH_FLAG_KEY);
    // Also clean up legacy key if present from older versions
    localStorage.removeItem('taskflow_user');
    this._currentUser.set(null);
    this._csrfToken.set(null);
    this._refreshInFlight$ = null;
  }

  /** Check if a session flag exists (no PII stored). */
  private hasStoredSession(): boolean {
    return localStorage.getItem(AUTH_FLAG_KEY) === '1';
  }

  /** Store a minimal non-sensitive session flag. */
  private storeSessionFlag(): void {
    localStorage.setItem(AUTH_FLAG_KEY, '1');
  }
}

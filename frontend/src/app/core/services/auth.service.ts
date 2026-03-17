import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  tap,
  catchError,
  throwError,
  BehaviorSubject,
  of,
  switchMap,
  filter,
  take,
  map,
  timeout,
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
  role: 'Admin' | 'Manager' | 'Member'; // Backend uses capitalized role names
  tenant_id: string;
  onboarding_completed: boolean;
  last_login_at: string | null;
}

export interface TokenResponse {
  csrf_token: string;
  user: User;
}

export interface SignInRequest {
  email: string;
  password: string;
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
  private refreshResult$ = new BehaviorSubject<
    'idle' | 'pending' | 'success' | 'failed'
  >('idle');

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
      .get<User>(`${this.apiUrl}/me`, { withCredentials: true })
      .pipe(
        map((user) => {
          this.storeSessionFlag();
          this._currentUser.set(user);
          return true;
        }),
        catchError(() =>
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
              catchError(() => {
                this.clearLocalState();
                return of(false);
              }),
            ),
        ),
      );
  }

  signIn(email: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/sign-in`, { email, password })
      .pipe(
        tap((response) => this.handleAuthSuccess(response)),
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
    if (this.refreshResult$.value === 'pending') {
      // A refresh is already in flight — wait for its result
      return this.waitForRefresh().pipe(
        switchMap((success) =>
          success
            ? of(null as unknown as TokenResponse)
            : throwError(() => new Error('Refresh failed')),
        ),
      );
    }

    this.refreshResult$.next('pending');

    return this.http
      .post<TokenResponse>(
        `${this.apiUrl}/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(
        timeout(10000),
        tap((response) => {
          this.handleAuthSuccess(response);
          this.refreshResult$.next('success');
          setTimeout(() => this.refreshResult$.next('idle'), 100);
        }),
        catchError((error) => {
          this.refreshResult$.next('failed');
          setTimeout(() => this.refreshResult$.next('idle'), 100);
          return throwError(() => error);
        }),
      );
  }

  /**
   * Wait for an in-flight refresh to complete.
   * Returns true if refresh succeeded, false if it failed.
   */
  waitForRefresh(): Observable<boolean> {
    return this.refreshResult$.pipe(
      filter((status) => status === 'success' || status === 'failed'),
      take(1),
      map((status) => status === 'success'),
    );
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

  isRefreshInProgress(): boolean {
    return this.refreshResult$.value === 'pending';
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
    this.refreshResult$.next('idle');
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

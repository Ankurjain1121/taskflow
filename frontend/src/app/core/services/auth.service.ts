import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  email_verified: boolean;
  role?: 'admin' | 'manager' | 'member';
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
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

const USER_KEY = 'taskflow_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = '/api/auth';
  private _currentUser = signal<User | null>(this.loadUserFromStorage());
  private refreshInProgress$ = new BehaviorSubject<boolean>(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  signIn(email: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/sign-in`, { email, password })
      .pipe(
        tap((response) => this.handleAuthSuccess(response)),
        catchError((error) => {
          console.error('Sign in failed:', error);
          return throwError(() => error);
        })
      );
  }

  signUp(request: SignUpRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/sign-up`, request)
      .pipe(
        tap((response) => this.handleAuthSuccess(response)),
        catchError((error) => {
          console.error('Sign up failed:', error);
          return throwError(() => error);
        })
      );
  }

  refresh(): Observable<TokenResponse> {
    this.refreshInProgress$.next(true);

    // No need to send refresh_token in body - it's sent automatically as a cookie
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/refresh`, {})
      .pipe(
        tap((response) => {
          this.handleAuthSuccess(response);
          this.refreshInProgress$.next(false);
        }),
        catchError((error) => {
          this.refreshInProgress$.next(false);
          this.signOut();
          return throwError(() => error);
        })
      );
  }

  signOut(): void {
    // Call the logout endpoint to clear server-side cookies
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      error: () => {
        // Ignore errors - clear local state regardless
      },
    });
    localStorage.removeItem(USER_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/auth/sign-in']);
  }

  getAccessToken(): string | null {
    // Tokens are now in HttpOnly cookies - not accessible from JS.
    // This method exists for backward compat; returns null.
    return null;
  }

  getRefreshToken(): string | null {
    // Tokens are now in HttpOnly cookies - not accessible from JS.
    return null;
  }

  isRefreshInProgress(): boolean {
    return this.refreshInProgress$.value;
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, {
      token,
      new_password: newPassword,
    });
  }

  private handleAuthSuccess(response: TokenResponse): void {
    // Tokens are set as HttpOnly cookies by the server - no localStorage needed for tokens.
    // We still store the user object for quick access on page reload.
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this._currentUser.set(response.user);
  }

  private loadUserFromStorage(): User | null {
    const userJson = localStorage.getItem(USER_KEY);
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch {
        return null;
      }
    }
    return null;
  }
}

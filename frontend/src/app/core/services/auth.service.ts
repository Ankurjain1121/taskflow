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

const ACCESS_TOKEN_KEY = 'taskflow_access_token';
const REFRESH_TOKEN_KEY = 'taskflow_refresh_token';
const USER_KEY = 'taskflow_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = '/api/v1/auth';
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

  refresh(): Observable<TokenResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    this.refreshInProgress$.next(true);

    return this.http
      .post<TokenResponse>(`${this.apiUrl}/refresh`, { refresh_token: refreshToken })
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
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/auth/sign-in']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  isRefreshInProgress(): boolean {
    return this.refreshInProgress$.value;
  }

  private handleAuthSuccess(response: TokenResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
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

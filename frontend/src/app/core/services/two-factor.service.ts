import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TwoFactorSetupResponse {
  secret: string;
  otpauth_uri: string;
}

export interface TwoFactorVerifyResponse {
  recovery_codes: string[];
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
}

export interface TwoFactorChallengeResponse {
  csrf_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenant_id: string;
    avatar_url: string | null;
    phone_number: string | null;
    job_title: string | null;
    department: string | null;
    bio: string | null;
    onboarding_completed: boolean;
    last_login_at: string | null;
  };
}

@Injectable({
  providedIn: 'root',
})
export class TwoFactorService {
  private readonly apiUrl = '/api/auth/2fa';

  constructor(private http: HttpClient) {}

  /** Start 2FA setup - returns secret and otpauth URI */
  setup(): Observable<TwoFactorSetupResponse> {
    return this.http.post<TwoFactorSetupResponse>(`${this.apiUrl}/setup`, {});
  }

  /** Verify TOTP code during setup to enable 2FA */
  verify(code: string): Observable<TwoFactorVerifyResponse> {
    return this.http.post<TwoFactorVerifyResponse>(`${this.apiUrl}/verify`, {
      code,
    });
  }

  /** Disable 2FA with a TOTP code or recovery code */
  disable(params: {
    code?: string;
    recovery_code?: string;
  }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/disable`,
      params,
    );
  }

  /** Complete 2FA challenge during login */
  challenge(params: {
    temp_token: string;
    code?: string;
    recovery_code?: string;
  }): Observable<TwoFactorChallengeResponse> {
    return this.http.post<TwoFactorChallengeResponse>(
      `${this.apiUrl}/challenge`,
      params,
    );
  }

  /** Check if 2FA is enabled for the current user */
  getStatus(): Observable<TwoFactorStatusResponse> {
    return this.http.get<TwoFactorStatusResponse>(`${this.apiUrl}/status`);
  }
}

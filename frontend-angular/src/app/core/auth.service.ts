import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import type { AuthSession, AuthUser } from './models';

type MeResponse = {
  id?: string;
  userId?: string;
  email: string;
  displayName: string;
  role: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);

  saveSession(s: AuthSession) {
    this.user.set({
      userId: s.userId,
      email: s.email,
      displayName: s.displayName,
      role: s.role,
    });
  }

  clearSession() {
    this.user.set(null);
  }

  async bootstrap(): Promise<void> {
    try {
      const me = await this.api.request<MeResponse>('/api/users/me');
      const userId = me.userId || me.id;
      if (!userId) {
        this.clearSession();
      } else {
        this.saveSession({
          userId,
          email: me.email,
          displayName: me.displayName,
          role: me.role,
        });
      }
    } catch {
      this.clearSession();
    } finally {
      this.ready.set(true);
    }
  }

  async login(email: string, password: string, clientIp?: string): Promise<AuthSession> {
    const session = await this.api.request<AuthSession>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password, clientIp }),
    });
    this.saveSession(session);
    return session;
  }

  async register(
    email: string,
    password: string,
    displayName: string,
    clientIp?: string,
  ): Promise<AuthSession> {
    const session = await this.api.request<AuthSession>('/api/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password, displayName, clientIp }),
    });
    this.saveSession(session);
    return session;
  }

  async logout(): Promise<void> {
    try {
      await this.api.request('/api/auth/logout', { method: 'POST', auth: false });
    } catch {
      /* still clear client state */
    }
    this.clearSession();
  }
}

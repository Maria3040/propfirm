import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

type LoginHistoryRow = {
  id: string;
  ip: string;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  isp: string | null;
  org: string | null;
  connectionKind: string;
  connectionLabel: string;
  userAgent: string | null;
  createdAt: string;
};

@Component({
  selector: 'app-settings-security-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="settings-page ss-page">
      <h1 class="settings-page-title ss-visually-hidden">Security</h1>

      <section class="ss-block">
        <h2 class="ss-section-title">Change Password</h2>
        <form id="change-password-form" (ngSubmit)="onChangePassword()">
          <div class="ss-password-row">
            <div class="settings-field">
              <label for="current_password">Current Password</label>
              <input id="current_password" name="current_password" class="settings-input" type="password" autocomplete="current-password" placeholder="Enter your current password" [(ngModel)]="currentPassword" />
            </div>
            <div class="settings-field">
              <label for="password">New Password</label>
              <input id="password" name="password" class="settings-input" type="password" autocomplete="new-password" placeholder="New Password" [(ngModel)]="password" />
            </div>
            <div class="settings-field">
              <label for="password_confirmation">Confirm Password</label>
              <input id="password_confirmation" name="password_confirmation" class="settings-input" type="password" autocomplete="new-password" placeholder="Confirm New Password" [(ngModel)]="confirm" />
            </div>
          </div>
          <div class="ss-password-actions">
            @if (err()) {
              <p class="ss-err">{{ err() }}</p>
            }
            @if (msg()) {
              <p class="ss-ok">{{ msg() }}</p>
            }
            <button type="submit" class="settings-save-btn">Change Password</button>
          </div>
        </form>
      </section>

      <section class="ss-block">
        <div class="ss-2fa-head">
          <h2 class="ss-section-title">Two-Factor Authentication</h2>
          <span class="ss-2fa-badge" [class.on]="twoFa()">{{ twoFa() ? 'Enabled' : 'Disabled' }}</span>
        </div>
        <div class="ss-2fa-panel">
          <button type="button" class="settings-save-btn" [disabled]="twoFaBusy()" (click)="toggleTwoFa()">
            {{ twoFaBusy() ? 'Saving…' : twoFa() ? 'Disable 2FA' : 'Enable 2FA' }}
          </button>
        </div>
      </section>

      <section class="ss-block">
        <div class="ss-history-head">
          <h2 class="ss-section-title">Login History</h2>
          <p class="ss-history-desc">
            Recent sign-ins with IP, country, and whether the connection looks like a VPN, VPS/datacenter, or a residential (real) IP.
          </p>
        </div>

        @if (historyLoading()) {
          <p class="ss-history-meta">Loading login history…</p>
        }
        @if (historyErr()) {
          <p class="ss-err">{{ historyErr() }}</p>
        }
        @if (!historyLoading() && !historyErr() && history().length === 0) {
          <div class="ss-history-empty">
            <p>No logins recorded yet. Sign out and sign in again to capture your first session.</p>
          </div>
        }
        @if (history().length > 0) {
          <div class="ss-history-table-wrap">
            <table class="ss-history-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>IP address</th>
                  <th>Location</th>
                  <th>Connection</th>
                  <th>Network</th>
                </tr>
              </thead>
              <tbody>
                @for (row of history(); track row.id) {
                  <tr>
                    <td>
                      <time [attr.dateTime]="row.createdAt">{{ formatWhen(row.createdAt) }}</time>
                    </td>
                    <td>
                      <code class="ss-history-ip">{{ row.ip }}</code>
                    </td>
                    <td>
                      <span class="ss-history-loc">
                        @if (row.countryCode) {
                          <span class="ss-history-cc" [title]="row.country || ''">{{ row.countryCode }}</span>
                        }
                        {{ locationLine(row) }}
                      </span>
                    </td>
                    <td>
                      <span [class]="kindClass(row.connectionKind)">{{ row.connectionLabel }}</span>
                    </td>
                    <td>
                      <span class="ss-history-isp" [title]="row.org || ''">{{ row.isp || row.org || '—' }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <ul class="ss-history-cards" aria-label="Login history">
            @for (row of history(); track row.id) {
              <li class="ss-history-card">
                <div class="ss-history-card-top">
                  <time [attr.dateTime]="row.createdAt">{{ formatWhen(row.createdAt) }}</time>
                  <span [class]="kindClass(row.connectionKind)">{{ row.connectionLabel }}</span>
                </div>
                <code class="ss-history-ip">{{ row.ip }}</code>
                <p>{{ locationLine(row) }}</p>
                <p class="ss-history-isp">{{ row.isp || row.org || 'Network unknown' }}</p>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
})
export class SettingsSecurityPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private cancelled = false;

  currentPassword = '';
  password = '';
  confirm = '';
  readonly msg = signal<string | null>(null);
  readonly err = signal<string | null>(null);
  readonly twoFa = signal(false);
  readonly twoFaBusy = signal(false);
  readonly history = signal<LoginHistoryRow[]>([]);
  readonly historyLoading = signal(true);
  readonly historyErr = signal<string | null>(null);

  ngOnInit() {
    void this.load();
  }

  ngOnDestroy() {
    this.cancelled = true;
  }

  formatWhen(iso: string) {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  kindClass(kind: string) {
    switch (kind) {
      case 'vpn':
        return 'ss-kind vpn';
      case 'vps':
        return 'ss-kind vps';
      case 'residential':
        return 'ss-kind real';
      case 'local':
        return 'ss-kind local';
      default:
        return 'ss-kind unknown';
    }
  }

  locationLine(row: LoginHistoryRow) {
    const parts = [row.city, row.country].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Location unknown';
  }

  async onChangePassword() {
    this.msg.set(null);
    this.err.set(null);
    if (!this.currentPassword || !this.password || !this.confirm) {
      this.err.set('Please fill in all password fields.');
      return;
    }
    if (this.password.length < 8) {
      this.err.set('New password must be at least 8 characters.');
      return;
    }
    if (this.password !== this.confirm) {
      this.err.set('New password and confirmation do not match.');
      return;
    }
    try {
      await this.api.request('/api/users/me/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: this.currentPassword, newPassword: this.password }),
      });
      this.currentPassword = '';
      this.password = '';
      this.confirm = '';
      this.msg.set('Password updated.');
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : 'Password update failed');
    }
  }

  async toggleTwoFa() {
    this.msg.set(null);
    this.err.set(null);
    this.twoFaBusy.set(true);
    try {
      const next = !this.twoFa();
      const res = await this.api.request<{ twoFactorEnabled: boolean }>('/api/users/me/2fa', {
        method: 'POST',
        body: JSON.stringify({ enabled: next }),
      });
      this.twoFa.set(!!res.twoFactorEnabled);
      this.msg.set(res.twoFactorEnabled ? '2FA enabled (persists after refresh).' : '2FA disabled.');
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : '2FA update failed');
    } finally {
      this.twoFaBusy.set(false);
    }
  }

  private async load() {
    try {
      const [rows, me] = await Promise.all([
        this.api.request<LoginHistoryRow[]>('/api/users/me/login-history'),
        this.api.request<{ twoFactorEnabled?: boolean }>('/api/users/me'),
      ]);
      if (!this.cancelled) {
        this.history.set(rows);
        this.twoFa.set(!!me.twoFactorEnabled);
      }
    } catch (ex: unknown) {
      if (!this.cancelled) this.historyErr.set(ex instanceof Error ? ex.message : 'Failed to load history');
    } finally {
      if (!this.cancelled) this.historyLoading.set(false);
    }
  }
}

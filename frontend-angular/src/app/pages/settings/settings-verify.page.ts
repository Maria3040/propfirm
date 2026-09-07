import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';

type VerificationState = {
  status: string;
  requestedAt?: string | null;
  decidedAt?: string | null;
  adminComment?: string | null;
};

@Component({
  selector: 'app-settings-verify-page',
  standalone: true,
  template: `
    <div class="settings-page">
      <h1 class="settings-page-title">Account Verification</h1>

      <div class="sv-card">
        <div class="sv-card-top">
          <div class="sv-status-row">
            <div class="sv-status-lead">
              <span class="sv-status-icon">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                  <path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.27,47,25.53a8,8,0,0,0,4.2,0c1-.26,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0Z" />
                </svg>
              </span>
              <div>
                <h3>
                  {{
                    approved()
                      ? 'Identity Verified'
                      : pending()
                        ? 'Verification In Review'
                        : rejected()
                          ? 'Verification Rejected'
                          : 'Identity Verification Available'
                  }}
                </h3>
                <p>
                  {{
                    approved()
                      ? 'Your account identity has been approved.'
                      : pending()
                        ? 'An admin is reviewing your request. Status updates automatically.'
                        : rejected()
                          ? 'You can submit again after reviewing the admin comment.'
                          : 'You can now verify your identity'
                  }}
                </p>
              </div>
            </div>
            <span
              class="sv-badge"
              [class.ok]="approved()"
              [class.bad]="rejected()"
              [class.pending]="pending()"
            >
              {{ badgeLabel() }}
            </span>
          </div>
        </div>

        <div class="sv-card-body">
          <div class="sv-start-panel">
            <div class="sv-start-inner">
              <h3>
                {{
                  pending() ? 'Verification Pending' : approved() ? 'You are verified' : 'Start Verification'
                }}
              </h3>
              <p>
                {{
                  pending()
                    ? 'Waiting for admin review…'
                    : approved()
                      ? state().adminComment || 'No further action needed.'
                      : 'Verify your identity to unlock additional features. Admin review is required.'
                }}
              </p>
              @if (state().adminComment && (rejected() || approved())) {
                <p class="meta">Admin comment: {{ state().adminComment }}</p>
              }
              @if (err()) {
                <p class="err" role="alert">{{ err() }}</p>
              }
              @if (msg()) {
                <p class="settings-saved">{{ msg() }}</p>
              }
              @if (canStart()) {
                <button type="button" class="settings-save-btn sv-start-btn" (click)="start()" [disabled]="busy()" [attr.aria-busy]="busy()">
                  {{ busy() ? 'Submitting…' : rejected() ? 'Resubmit Verification' : 'Start Verification' }}
                </button>
              } @else {
                <button type="button" class="settings-save-btn sv-start-btn" disabled>
                  {{ pending() ? 'Waiting for admin…' : 'Verified' }}
                </button>
              }
            </div>
            <span class="sv-powered">
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
              </svg>
              Powered by KYCAID
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SettingsVerifyPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private pollTimer: number | undefined;
  private focusHandler = () => void this.refresh();

  readonly state = signal<VerificationState>({ status: 'None' });
  readonly busy = signal(false);
  readonly err = signal('');
  readonly msg = signal('');

  pending = () => this.state().status === 'Pending';
  approved = () => this.state().status === 'Approved';
  rejected = () => this.state().status === 'Rejected';
  canStart = () => this.state().status === 'None' || this.rejected();

  badgeLabel() {
    switch (this.state().status) {
      case 'Pending':
        return 'In Progress';
      case 'Approved':
        return 'Verified';
      case 'Rejected':
        return 'Rejected';
      default:
        return 'Not Verified';
    }
  }

  ngOnInit() {
    void this.refresh();
    window.addEventListener('focus', this.focusHandler);
    document.addEventListener('visibilitychange', this.focusHandler);
  }

  ngOnDestroy() {
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    window.removeEventListener('focus', this.focusHandler);
    document.removeEventListener('visibilitychange', this.focusHandler);
  }

  async refresh() {
    try {
      const next = await this.api.request<VerificationState>('/api/users/me/verification');
      this.state.set(next);
      if (next.status === 'Approved') this.msg.set('Your identity is verified.');
      else if (next.status === 'Rejected') {
        this.msg.set(next.adminComment ? `Rejected: ${next.adminComment}` : 'Verification was rejected.');
      }
      this.syncPoll();
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'Failed to load verification status');
    }
  }

  async start() {
    this.err.set('');
    this.msg.set('');
    this.busy.set(true);
    try {
      const next = await this.api.request<VerificationState>('/api/users/me/verification/start', {
        method: 'POST',
        body: '{}',
      });
      this.state.set(next);
      if (next.status === 'Approved') this.msg.set('Your identity is already verified.');
      else this.msg.set('Verification submitted. This page updates when an admin decides (email via Mailpit).');
      this.syncPoll();
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : 'Failed to start verification');
    } finally {
      this.busy.set(false);
    }
  }

  private syncPoll() {
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    if (this.state().status === 'Pending') {
      this.pollTimer = window.setInterval(() => void this.refresh(), 4000);
    }
  }
}

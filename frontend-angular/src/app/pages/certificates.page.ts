import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ChallengeRow } from '../core/models';
import {
  certificatesFromApprovedPayouts,
  formatCertAmount,
  formatCertDate,
  type PayoutCertificate,
} from '../data/certificates-data';

type PayoutPage = {
  items: Array<{
    id: string;
    amount: number | string;
    status: string;
    challengeId?: string | null;
    method?: string | null;
    rewardType?: string | null;
    cryptoNetwork?: string | null;
    createdAt: string;
    decidedAt?: string | null;
  }>;
};

@Component({
  selector: 'app-certificates-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="cert-page">
      <header class="cert-heading">
        <h1>Certificates</h1>
        <p>Official proof of trading payouts issued for your funded accounts.</p>
      </header>

      @if (err()) {
        <p class="err" role="alert">{{ err() }}</p>
      }
      @if (loading()) {
        <p class="meta">Loading certificates…</p>
      }

      @if (!loading() && !err() && certs().length === 0) {
        <div class="cert-empty">
          <h2>No certificates yet</h2>
          <p>You'll earn a reward certificate once a payout is approved by admin.</p>
          <a routerLink="/payouts" class="cert-btn" style="display:inline-block;margin-top:1rem">
            View rewards
          </a>
        </div>
      }

      @if (!loading() && selected(); as sel) {
        <div class="cert-layout">
          <aside class="cert-list" aria-label="Your certificates">
            @for (c of certs(); track c.id) {
              <button
                type="button"
                class="cert-thumb"
                [class.on]="c.id === sel.id"
                [attr.aria-pressed]="c.id === sel.id"
                (click)="selectedId.set(c.id)"
              >
                <div class="cert-thumb-art" aria-hidden="true">
                  <span class="cert-thumb-amount">{{ formatCertAmount(c.amount, c.currency) }}</span>
                  <span class="cert-thumb-date">{{ formatCertDate(c.paidAt) }}</span>
                </div>
                <div class="cert-thumb-meta">
                  <strong>{{ name() }}</strong>
                  <span>{{ c.id }}</span>
                </div>
              </button>
            }
          </aside>
          <div class="cert-preview">
            <article class="cert-sheet" [attr.aria-label]="'Payout certificate ' + sel.id">
              <div class="cert-sheet-frame">
                <header class="cert-sheet-top">
                  <div class="cert-brand">
                    <span class="cert-brand-mark">PF</span>
                    <div>
                      <p class="cert-brand-name">PropFirm</p>
                      <p class="cert-brand-sub">Official Reward Certificate</p>
                    </div>
                  </div>
                  <p class="cert-id">{{ sel.id }}</p>
                </header>
                <div class="cert-sheet-body">
                  <p class="cert-eyebrow">This certifies that</p>
                  <h2 class="cert-name">{{ name() }}</h2>
                  <p class="cert-lede">
                    has successfully received a trading payout from a funded PropFirm account.
                  </p>
                  <div class="cert-amount-block">
                    <p>Reward amount</p>
                    <p class="cert-amount">{{ formatCertAmount(sel.amount, sel.currency) }}</p>
                  </div>
                  <dl class="cert-grid">
                    <div>
                      <dt>Account size</dt>
                      <dd>{{ sel.accountSize }}</dd>
                    </div>
                    <div>
                      <dt>Challenge</dt>
                      <dd>{{ sel.challenge }}</dd>
                    </div>
                    <div>
                      <dt>Paid on</dt>
                      <dd>{{ formatCertDate(sel.paidAt) }}</dd>
                    </div>
                    <div>
                      <dt>Payout method</dt>
                      <dd>{{ sel.method }}</dd>
                    </div>
                  </dl>
                </div>
                <footer class="cert-sheet-foot">
                  <div class="cert-sign">
                    <p class="cert-sign-line">Authorized signature</p>
                    <p class="cert-sign-name">PropFirm Rewards Desk</p>
                  </div>
                </footer>
              </div>
            </article>
            <div class="cert-actions">
              <button type="button" class="cert-btn" (click)="print()">Print / Save PDF</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class CertificatesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly name = signal('Trader');
  readonly certs = signal<PayoutCertificate[]>([]);
  readonly selectedId = signal('');
  readonly loading = signal(true);
  readonly err = signal('');
  readonly formatCertAmount = formatCertAmount;
  readonly formatCertDate = formatCertDate;

  readonly selected = computed(
    () => this.certs().find((c) => c.id === this.selectedId()) || this.certs()[0],
  );

  ngOnInit() {
    void this.load();
  }

  print() {
    window.print();
  }

  private async load() {
    this.loading.set(true);
    this.err.set('');
    try {
      const [me, payouts, challenges] = await Promise.all([
        this.api.request<{ displayName?: string }>('/api/users/me'),
        this.api.request<PayoutPage>(
          '/api/payouts?status=Approved&page=1&pageSize=50&sortBy=createdAt&sortDir=desc',
        ),
        this.api.request<ChallengeRow[]>('/api/challenges').catch(() => [] as ChallengeRow[]),
      ]);
      const traderName =
        me?.displayName || this.auth.user()?.displayName || 'Trader';
      this.name.set(traderName);
      const next = certificatesFromApprovedPayouts(
        Array.isArray(payouts.items) ? payouts.items : [],
        traderName,
        Array.isArray(challenges) ? challenges : [],
      );
      this.certs.set(next);
      this.selectedId.set(next[0]?.id || '');
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : 'Failed to load certificates');
    } finally {
      this.loading.set(false);
    }
  }
}

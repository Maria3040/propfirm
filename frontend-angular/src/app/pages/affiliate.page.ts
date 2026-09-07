import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import {
  AFFILIATE_CODE,
  AFFILIATE_REFERRALS,
  AFFILIATE_REWARDS,
  AFFILIATE_STATS,
  EARNINGS_SERIES,
  formatMoney,
  formatShortDate,
  type AffiliateReferral,
  type AffiliateReward,
  type EarningsPoint,
} from '../lib/affiliate-data';

type MainTab = 'earnings' | 'rewards';
type ViewMode = 'overview' | 'daily';
type ChartMode = 'cumulative' | 'daily';

type AffiliateDashboard = {
  code: string;
  referralUrl: string;
  stats: { totalReferrals: number; totalPaidOut: number; availableBalance: number };
  referrals: AffiliateReferral[];
  rewards: AffiliateReward[];
  earningsSeries: EarningsPoint[];
};

@Component({
  selector: 'app-affiliate-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="aff-page">
      <header class="aff-heading">
        <div class="aff-heading-row">
          <div class="aff-brand-lockup" aria-hidden>
            <span class="aff-brand-mark">PF</span>
            <span class="aff-brand-name">PropFirm</span>
          </div>
          <div class="aff-heading-rule"></div>
          <h1>Affiliate</h1>
        </div>
      </header>
      @if (loadErr()) {
        <p class="err">{{ loadErr() }}</p>
      }

      <div class="aff-tabs" role="tablist" aria-label="Affiliate">
        <button type="button" role="tab" [attr.aria-selected]="mainTab() === 'earnings'" [class.on]="mainTab() === 'earnings'" (click)="mainTab.set('earnings')">Earnings</button>
        <button type="button" role="tab" [attr.aria-selected]="mainTab() === 'rewards'" [class.on]="mainTab() === 'rewards'" (click)="mainTab.set('rewards')">Rewards</button>
      </div>

      @if (mainTab() === 'earnings') {
        <div role="tabpanel" class="aff-panel">
          <section class="aff-card">
            <h2>Referral Code</h2>
            <p class="aff-card-desc">Share your referral link or code to earn commissions.</p>
            <div class="aff-copy-row">
              <button type="button" class="aff-copy-btn grow" (click)="onCopy('link', referralUrl())">
                <span class="truncate">{{ referralUrl() }}</span>
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden><path d="M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z" /></svg>
              </button>
              <button type="button" class="aff-copy-btn" (click)="onCopy('code', code())">
                {{ code() }}
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden><path d="M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z" /></svg>
              </button>
            </div>
            @if (copied()) {
              <p class="aff-copied">{{ copied() === 'link' ? 'Link copied' : 'Code copied' }}</p>
            }
            <div class="aff-notice">
              <div class="aff-notice-text">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z" /></svg>
                <span>Commissions are credited when referred users complete qualifying purchases.</span>
              </div>
              <a class="aff-notice-link" href="https://app.fundingpips.com/affiliate" target="_blank" rel="noreferrer">Visit Affiliate Page</a>
            </div>
          </section>

          <div class="aff-subtabs">
            <button type="button" [class.on]="viewMode() === 'overview'" (click)="viewMode.set('overview')">Overview</button>
            <button type="button" [class.on]="viewMode() === 'daily'" (click)="viewMode.set('daily')">Daily</button>
          </div>

          @if (viewMode() === 'overview') {
            <div class="aff-overview">
              <div class="aff-overview-grid">
                <div class="aff-chart-col">
                  <div class="aff-chart-head">
                    <h3>Earnings</h3>
                    <div class="aff-chart-controls">
                      <label class="aff-date-range">
                        <input type="date" [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event)" aria-label="From date" />
                        <span>–</span>
                        <input type="date" [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event)" aria-label="To date" />
                      </label>
                      <button type="button" class="aff-chip" [class.primary]="chartMode() === 'cumulative'" (click)="chartMode.set('cumulative')">Cumulative</button>
                      <button type="button" class="aff-chip" [class.primary]="chartMode() === 'daily'" (click)="chartMode.set('daily')">Daily</button>
                    </div>
                  </div>
                  <div class="aff-chart-frame">
                    @if (chartEmpty()) {
                      <div class="aff-chart-empty">
                        <p class="aff-chart-empty-title">No referral data available</p>
                        <p class="aff-chart-empty-sub">Start referring users to see your earnings history</p>
                      </div>
                    } @else {
                      <svg class="aff-chart-svg" viewBox="0 0 640 280" role="img" aria-label="Affiliate earnings chart">
                        <rect x="0" y="0" width="640" height="280" rx="14" class="aff-chart-bg" />
                        <path [attr.d]="chartArea()" class="aff-chart-area" />
                        <path [attr.d]="chartPath()" class="aff-chart-line" fill="none" />
                      </svg>
                    }
                  </div>
                </div>
                <div class="aff-stats">
                  <div class="aff-stat"><span>Total Referrals</span><strong>{{ stats().totalReferrals }}</strong></div>
                  <div class="aff-stat"><span>Total Paid Out</span><strong>{{ formatMoney(stats().totalPaidOut) }}</strong></div>
                  <div class="aff-stat"><span>Available Balance</span><strong>{{ formatMoney(stats().availableBalance) }}</strong></div>
                </div>
              </div>

              @if (filteredReferrals().length === 0) {
                <div class="aff-empty-list"><p>No referrals found</p><p>Try adjusting the date range.</p></div>
              } @else {
                <div class="aff-table-wrap">
                  <table class="aff-table">
                    <thead><tr><th>Referral</th><th>Joined</th><th>Status</th><th class="end">Commission</th></tr></thead>
                    <tbody>
                      @for (r of filteredReferrals(); track r.id) {
                        <tr>
                          <td>{{ r.email }}</td>
                          <td>{{ formatShortDate(r.joinedAt) }}</td>
                          <td><span class="aff-status" [class]="r.status">{{ r.status }}</span></td>
                          <td class="end">{{ formatMoney(r.commission) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          } @else {
            <div class="aff-daily-list">
              <h3>Daily breakdown</h3>
              <ul>
                @for (p of earningsReversed(); track p.date) {
                  <li>
                    <span>{{ formatShortDate(p.date) }}</span>
                    <strong [class.pos]="p.amount > 0">{{ p.amount > 0 ? '+' + formatMoney(p.amount) : formatMoney(0) }}</strong>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      } @else {
        <div role="tabpanel" class="aff-panel">
          <div class="aff-rewards-grid">
            @for (rw of rewards(); track rw.id) {
              <article class="aff-reward" [class]="rw.status">
                <div class="aff-reward-top">
                  <h3>{{ rw.title }}</h3>
                  <span class="aff-status">{{ rw.status.replace('_', ' ') }}</span>
                </div>
                <p>{{ rw.description }}</p>
                <div class="aff-progress" aria-hidden>
                  <div [style.width.%]="Math.min(100, Math.round((rw.progress / rw.target) * 100))"></div>
                </div>
                <p class="aff-progress-label">
                  {{
                    rw.title === 'Growth' || rw.title === 'Starter'
                      ? formatMoney(Math.min(rw.progress, rw.target)) + ' / ' + formatMoney(rw.target)
                      : Math.min(rw.progress, rw.target) + ' / ' + rw.target
                  }}
                </p>
              </article>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class AffiliatePage implements OnInit {
  private readonly api = inject(ApiService);
  readonly Math = Math;
  readonly formatMoney = formatMoney;
  readonly formatShortDate = formatShortDate;

  readonly mainTab = signal<MainTab>('earnings');
  readonly viewMode = signal<ViewMode>('overview');
  readonly chartMode = signal<ChartMode>('cumulative');
  readonly copied = signal<'link' | 'code' | null>(null);
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly dash = signal<AffiliateDashboard | null>(null);
  readonly loadErr = signal('');

  readonly code = computed(() => this.dash()?.code || AFFILIATE_CODE);
  readonly stats = computed(() => this.dash()?.stats || AFFILIATE_STATS);
  readonly referrals = computed(() => this.dash()?.referrals || AFFILIATE_REFERRALS);
  readonly rewards = computed(() => this.dash()?.rewards || AFFILIATE_REWARDS);
  readonly earnings = computed(() => this.dash()?.earningsSeries || EARNINGS_SERIES);
  readonly referralUrl = computed(() => {
    if (this.dash()?.referralUrl) return this.dash()!.referralUrl;
    return `${window.location.origin}/register?referral_code=${this.code()}`;
  });
  readonly filteredReferrals = computed(() => {
    const from = this.dateFrom();
    const to = this.dateTo();
    return this.referrals().filter((r) => {
      if (from && r.joinedAt < from) return false;
      if (to && r.joinedAt > to) return false;
      return true;
    });
  });
  readonly earningsReversed = computed(() => [...this.earnings()].reverse());
  readonly chartEmpty = computed(() => this.earnings().every((p) => (this.chartMode() === 'cumulative' ? p.cumulative : p.amount) === 0));

  chartPath() {
    return this.chartGeometry().path;
  }
  chartArea() {
    return this.chartGeometry().area;
  }

  private chartGeometry() {
    const series = this.earnings();
    const values = series.map((p) => (this.chartMode() === 'cumulative' ? p.cumulative : p.amount));
    const max = Math.max(...values, 1);
    const pad = { t: 24, r: 16, b: 36, l: 48 };
    const iw = 640 - pad.l - pad.r;
    const ih = 280 - pad.t - pad.b;
    const points = values.map((v, i) => {
      const x = pad.l + (i / Math.max(values.length - 1, 1)) * iw;
      const y = pad.t + ih - (v / max) * ih;
      return { x, y };
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const area = `${path} L${points[points.length - 1].x},${pad.t + ih} L${points[0].x},${pad.t + ih} Z`;
    return { path, area };
  }

  ngOnInit() {
    void this.api
      .request<AffiliateDashboard>('/api/affiliate/me')
      .then((d) => this.dash.set(d))
      .catch((e) => this.loadErr.set(String(e.message || e)));
  }

  async onCopy(kind: 'link' | 'code', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(kind);
      window.setTimeout(() => this.copied.set(null), 1600);
    } catch {
      /* ignore */
    }
  }
}

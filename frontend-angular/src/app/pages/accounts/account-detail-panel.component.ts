import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmDialogComponent } from '../../components/confirm-dialog.component';
import { CopyValueComponent } from '../../components/copy-value.component';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  ChallengeDetail,
  money,
  moneyPlain,
  phaseLabel,
  statusClass,
  tradingDisabled,
  typeLabel,
} from '../../core/models';

type Detail = ChallengeDetail & {
  equitySeries?: { t: string; equity: number; dayPnl: number }[];
  hasProfitTarget?: boolean;
  dailyLossPct?: number;
  maxLossPct?: number;
  maxTradingDays?: number;
  progress: ChallengeDetail['progress'] & {
    dailyCap?: number;
    dailyLossRemaining?: number;
    maxLossRemaining?: number;
    hasProfitTarget?: boolean;
    maxTradingDays?: number;
  };
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function platformLabel(p?: string | null) {
  const s = (p || '').toLowerCase();
  if (s.includes('match')) return 'MatchTrader';
  if (s.includes('mt5') || s === 'mt5') return 'MT5';
  if (s.includes('mt4')) return 'MT4';
  return p || 'MT5';
}

@Component({
  selector: 'app-account-detail-panel',
  standalone: true,
  imports: [RouterLink, FormsModule, ConfirmDialogComponent, CopyValueComponent],
  template: `
    @if (err() && !data()) {
      <div class="acc-detail-empty">
        <p class="err">{{ err() }}</p>
      </div>
    } @else if (!data()) {
      <div class="acc-detail-empty">
        <p class="meta">Loading account…</p>
      </div>
    } @else {
      <div class="acc-detail">
        <nav class="acc-crumbs" aria-label="breadcrumb">
          <a routerLink="/">Home</a>
          <span aria-hidden="true">›</span>
          <a routerLink="/accounts">Accounts</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">#{{ login() }}</span>
        </nav>

        @if (disabled()) {
          <div class="acc-alert" role="status">
            <strong>Trading Disabled</strong>
            <p>{{ data()!.failReason || 'Trading is currently disabled for this account.' }}</p>
          </div>
        }

        <header class="acc-detail-head">
          <div>
            <div class="acc-detail-brand">
              <span class="acc-logo-mark" aria-hidden="true">PF</span>
              <span class="acc-detail-login">#{{ login() }}</span>
              <span class="acc-detail-created">Created {{ fmtDate(data()!.createdAt) }}</span>
            </div>
            <div class="acc-detail-pills">
              <span [class]="statusClass(data()!.status)">{{ data()!.status }}</span>
              <span class="acc-pill">{{ type() }}</span>
              <span class="acc-pill">{{ phase() }}</span>
              <span class="acc-pill">{{ platformLabel(data()!.account?.platform) }}</span>
            </div>
          </div>
          <div class="acc-detail-actions">
            <button type="button" class="acc-btn-outline" (click)="credOpen.set(true)">
              Credentials
            </button>
            @if (!['Closed', 'Cancelled'].includes(data()!.status)) {
              <button type="button" class="acc-btn-outline" (click)="archiveOpen.set(true)">
                Archive
              </button>
            }
          </div>
        </header>

        <div class="acc-metric-grid">
          <div class="acc-metric-card">
            <span>Account Size</span>
            <strong>{{ moneyPlain(size()) }}</strong>
          </div>
          <div class="acc-metric-card">
            <span>Today's Profit</span>
            <strong [class.up]="dayPnl() >= 0" [class.down]="dayPnl() < 0">{{
              money(dayPnl())
            }}</strong>
          </div>
          <div class="acc-metric-card">
            <span>Equity</span>
            <strong>{{ moneyPlain(equity()) }}</strong>
          </div>
          <div class="acc-metric-card">
            <span>Total P&amp;L</span>
            <strong [class.up]="pnlTotal() >= 0" [class.down]="pnlTotal() < 0">{{
              money(pnlTotal())
            }}</strong>
          </div>
        </div>

        <div class="acc-score-row">
          <div class="acc-score-card">
            <div class="acc-score-label">Score</div>
            <div class="acc-score-value">{{ score() }}</div>
            <div class="acc-score-axes">
              <span>Consistency</span>
              <span>WR</span>
              <span>RR</span>
              <span>SL</span>
            </div>
          </div>
          <div class="acc-gauges-card">
            <div class="acc-gauge">
              <div class="acc-gauge-ring" [style.--p]="balanceGaugePct() + '%'">
                <strong>{{ balanceGaugeRounded() }}%</strong>
              </div>
              <div class="acc-gauge-meta">
                <span>Balance</span>
                <em>Max</em>
              </div>
            </div>
            <div class="acc-gauge">
              <div class="acc-gauge-ring" [style.--p]="equityGaugePct() + '%'">
                <strong>{{ equityGaugeRounded() }}%</strong>
              </div>
              <div class="acc-gauge-meta">
                <span>Equity</span>
                <em>Max</em>
              </div>
            </div>
          </div>
        </div>

        <section class="acc-section">
          <div class="acc-section-head">
            <span>Account Balance</span>
          </div>
          <div class="acc-chart-wrap">
            @if (!sparkPoints()) {
              <div class="acc-chart-empty"><span>No equity history yet</span></div>
            } @else {
              <svg
                class="acc-spark"
                viewBox="0 0 640 220"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  [attr.points]="sparkPoints()"
                />
              </svg>
            }
          </div>
        </section>

        <div class="acc-metric-grid">
          <div class="acc-metric-card">
            <span>Profit %</span>
            <strong [class.up]="profitPct() >= 0" [class.down]="profitPct() < 0">
              {{ profitPct() >= 0 ? '+' : '' }}{{ profitPct().toFixed(1) }}%
            </strong>
          </div>
          <div class="acc-metric-card">
            <span>Target</span>
            <strong>{{ hasProfitTarget() ? targetPct() + '%' : 'None' }}</strong>
          </div>
          <div class="acc-metric-card">
            <span>Trading Days</span>
            <strong>
              {{ tradingDays()
              }}{{ minDays() > 0 ? ' / min ' + minDays() : ''
              }}{{ maxDays() > 0 ? ' / max ' + maxDays() : '' }}
            </strong>
          </div>
          <div class="acc-metric-card">
            <span>Phase</span>
            <strong>
              {{
                data()!.status === 'Funded'
                  ? 'Funded'
                  : data()!.currentPhase + ' / ' + data()!.phases
              }}
            </strong>
          </div>
        </div>

        <section class="acc-section">
          <span class="acc-section-title">Trading Objectives</span>
          <div class="acc-rules">
            <div class="acc-rule">
              <div class="acc-rule-top">
                <span>Maximum Daily Loss</span>
                <span>Remaining: {{ moneyPlain(dailyRemain()) }}</span>
              </div>
              <p class="meta">
                Max allowed {{ moneyPlain(dailyCap()) }} · Today's PnL {{ money(dayPnl()) }} ·
                Updates with today's PnL
              </p>
              <div class="acc-rule-bar">
                <span [style.width.%]="dailyBarPct()"></span>
              </div>
            </div>
            <div class="acc-rule">
              <div class="acc-rule-top">
                <span>Maximum Loss</span>
                <span>Remaining: {{ moneyPlain(totalRemain()) }}</span>
              </div>
              <p class="meta">
                Max allowed {{ moneyPlain(totalCap()) }} · Balance threshold
                {{ moneyPlain(size() - totalCap()) }}
              </p>
              <div class="acc-rule-bar">
                <span [style.width.%]="totalBarPct()"></span>
              </div>
            </div>
            @if (minDays() > 0 || maxDays() > 0) {
              <div class="acc-rule">
                <div class="acc-rule-top">
                  <span>Trading Days</span>
                  <span>
                    {{ tradingDays()
                    }}{{ minDays() > 0 ? ' / min ' + minDays() : ''
                    }}{{ maxDays() > 0 ? ' · max ' + maxDays() : '' }}
                  </span>
                </div>
                <p class="meta">
                  @if (minDays() > 0) {
                    {{
                      minDaysMet()
                        ? 'Minimum trading days met.'
                        : 'Need ' + (minDays() - tradingDays()) + ' more trading day(s) before profit target can pass.'
                    }}
                  }
                  @if (maxDays() > 0) {
                    {{
                      maxDaysOk()
                        ? ' ' + (maxDays() - tradingDays()) + ' day(s) left before max trading days.'
                        : ' Max trading days exceeded — account should breach.'
                    }}
                  }
                </p>
                <div class="acc-rule-bar">
                  <span [style.width.%]="daysBarPct()"></span>
                </div>
              </div>
            }
            @if (hasProfitTarget()) {
              <div class="acc-rule">
                <div class="acc-rule-top">
                  <span>Profit Target</span>
                  <span>{{ profitPct().toFixed(1) }}% / {{ targetPct() }}%</span>
                </div>
                <div class="acc-rule-bar">
                  <span [style.width.%]="targetBarPct()"></span>
                </div>
              </div>
            }
          </div>
        </section>

        @if (canSimulate()) {
          <form class="acc-sim card stack" (ngSubmit)="simulate()">
            <h3>Simulate trade</h3>
            <label>
              PnL ($)
              <input [(ngModel)]="pnl" name="pnl" [disabled]="disabled()" />
            </label>
            <label>
              Trade day
              <input
                type="date"
                [(ngModel)]="tradeDay"
                name="tradeDay"
                [disabled]="disabled()"
              />
            </label>
            <p class="meta">
              Pick another date to accumulate trading days (min {{ minDays() || 0
              }}{{ maxDays() > 0 ? ', max ' + maxDays() : '' }}). Daily loss uses that day's PnL.
            </p>
            <button class="btn" type="submit" [disabled]="disabled()">
              Execute simulated trade
            </button>
            @if (msg()) {
              <p class="meta">{{ msg() }}</p>
            }
          </form>
        }

        @if (err()) {
          <p class="err">{{ err() }}</p>
        }

        <app-confirm-dialog
          [open]="archiveOpen()"
          title="Archive this account?"
          [description]="
            '#' + login() + ' will be closed and trading disabled. You can still find it under Show Archived.'
          "
          confirmLabel="Archive"
          [danger]="true"
          [busy]="archiveBusy()"
          (cancel)="!archiveBusy() && archiveOpen.set(false)"
          (confirm)="confirmArchive()"
        />

        @if (credOpen()) {
          <div class="acc-modal-backdrop" role="presentation" (click)="credOpen.set(false)">
            <div
              class="acc-cred-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="acc-cred-title"
              aria-describedby="acc-cred-desc"
              (click)="$event.stopPropagation()"
            >
              <div class="acc-cred-header">
                <h2 id="acc-cred-title">Account Credentials</h2>
                <p id="acc-cred-desc" class="meta">#{{ login() }}</p>
              </div>
              <div class="acc-cred-body">
                @if (data()!.account; as account) {
                  <dl>
                    <div>
                      <dt>Account Username</dt>
                      <app-copy-value [value]="accountEmail()" label="Account Username" />
                    </div>
                  </dl>
                  <dl>
                    <div>
                      <dt>Account</dt>
                      <app-copy-value [value]="login()" label="Account" />
                    </div>
                  </dl>
                  <dl>
                    <div>
                      <dt>Password</dt>
                      <app-copy-value [value]="account.password" label="Password" />
                    </div>
                  </dl>
                  <dl>
                    <div>
                      <dt>Investor Password</dt>
                      <dd class="acc-cred-value"><span>—</span></dd>
                    </div>
                  </dl>
                  <dl>
                    <div>
                      <dt>Server</dt>
                      <app-copy-value
                        [value]="account.server || 'PropFirm-Demo'"
                        label="Server"
                      />
                    </div>
                  </dl>
                  <dl>
                    <div>
                      <dt>Platform</dt>
                      <dd class="acc-cred-value">
                        <span>{{ platformLabel(account.platform) }}</span>
                      </dd>
                    </div>
                  </dl>
                } @else {
                  <p class="meta">No trading account provisioned yet.</p>
                }
              </div>
              <div class="acc-cred-footer">
                <a
                  href="https://help.fundingpips.com/en/collections/12032232-how-to-log-in-to-our-trading-platforms"
                  >Having trouble logging in?</a
                >
                <a
                  href="https://mtr-competition.fundingpips.com"
                  rel="noopener noreferrer"
                  target="_blank"
                  class="acc-cred-platform-link"
                  >Open MatchTrader</a
                >
              </div>
              <button
                type="button"
                class="acc-cred-close"
                aria-label="Close"
                (click)="credOpen.set(false)"
              >
                ×
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class AccountDetailPanelComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly challengeId = input.required<string>();
  readonly archived = output<void>();

  readonly data = signal<Detail | null>(null);
  readonly err = signal('');
  readonly credOpen = signal(false);
  readonly archiveOpen = signal(false);
  readonly archiveBusy = signal(false);
  readonly msg = signal('');

  pnl = '200';
  tradeDay = new Date().toISOString().slice(0, 10);

  readonly money = money;
  readonly moneyPlain = moneyPlain;
  readonly statusClass = statusClass;
  readonly fmtDate = fmtDate;
  readonly platformLabel = platformLabel;

  readonly accountEmail = computed(() => this.auth.user()?.email || '—');

  constructor() {
    effect(() => {
      const id = this.challengeId();
      if (!id) return;
      this.data.set(null);
      this.credOpen.set(false);
      this.archiveOpen.set(false);
      this.msg.set('');
      void this.load();
    });
  }

  readonly equity = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return d.progress?.equity ?? d.account?.equity ?? d.accountSize;
  });
  readonly size = computed(() => this.data()?.accountSize ?? 0);
  readonly pnlTotal = computed(() => this.equity() - this.size());
  readonly maxEq = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return d.progress?.maxEquity || Math.max(this.equity(), this.size());
  });
  readonly disabled = computed(() => {
    const d = this.data();
    if (!d) return false;
    return tradingDisabled(d.status) || !!d.account?.locked;
  });
  readonly type = computed(() => (this.data() ? typeLabel(this.data()!.sku) : ''));
  readonly phase = computed(() => (this.data() ? phaseLabel(this.data()!) : ''));
  readonly login = computed(() => {
    const d = this.data();
    if (!d) return '';
    return d.account?.login || d.id.slice(0, 9);
  });
  readonly dailyCap = computed(() => {
    const d = this.data();
    if (!d) return 0;
    const size = this.size();
    return d.progress?.dailyCap ?? size * ((d.maxDailyLossPct || d.dailyLossPct || 5) / 100);
  });
  readonly totalCap = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return this.size() * ((d.maxTotalLossPct || d.maxLossPct || 10) / 100);
  });
  readonly dayPnl = computed(() => this.data()?.progress?.dayPnl ?? 0);
  readonly profitPct = computed(() => this.data()?.progress?.profitPct ?? 0);
  readonly targetPct = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return Number(d.progress?.targetPct ?? d.profitTargetPct ?? 0) || 0;
  });
  readonly hasProfitTarget = computed(() => {
    const d = this.data();
    if (!d) return false;
    return d.progress?.hasProfitTarget ?? d.hasProfitTarget ?? this.targetPct() > 0;
  });
  readonly tradingDays = computed(() => this.data()?.progress?.tradingDays ?? 0);
  readonly minDays = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return d.minTradingDays ?? d.progress?.minTradingDays ?? 0;
  });
  readonly maxDays = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return d.maxTradingDays ?? d.progress?.maxTradingDays ?? 0;
  });
  readonly dailyRemain = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return d.progress?.dailyLossRemaining ?? Math.max(0, this.dailyCap() + Math.min(0, this.dayPnl()));
  });
  readonly totalRemain = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return d.progress?.maxLossRemaining ?? Math.max(0, this.equity() - (this.size() - this.totalCap()));
  });
  readonly canSimulate = computed(() => {
    const d = this.data();
    if (!d) return false;
    return (d.status === 'Active' || d.status === 'Funded') && !d.account?.locked;
  });
  readonly minDaysMet = computed(() => this.minDays() <= 0 || this.tradingDays() >= this.minDays());
  readonly maxDaysOk = computed(() => this.maxDays() <= 0 || this.tradingDays() <= this.maxDays());
  readonly score = computed(() => {
    const d = this.data();
    if (!d) return 0;
    const wr = Math.min(100, Math.max(0, 50 + (d.progress?.profitPct ?? 0) * 2));
    return Math.round(wr * 10) / 10;
  });
  readonly balanceGaugePct = computed(() =>
    Math.min(100, Math.max(0, (this.equity() / Math.max(1, this.maxEq())) * 100)),
  );
  readonly equityGaugePct = computed(() => {
    const d = this.data();
    const max = Math.max(this.maxEq(), Number(d?.progress?.targetEquity) || this.size());
    return Math.min(100, Math.max(0, (this.equity() / Math.max(1, max)) * 100));
  });
  readonly balanceGaugeRounded = computed(() => Math.round(this.balanceGaugePct()));
  readonly equityGaugeRounded = computed(() => Math.round(this.equityGaugePct()));
  readonly dailyBarPct = computed(() =>
    Math.min(100, (Math.abs(Math.min(0, this.dayPnl())) / Math.max(1, this.dailyCap())) * 100),
  );
  readonly totalBarPct = computed(() =>
    Math.min(100, (Math.max(0, this.size() - this.equity()) / Math.max(1, this.totalCap())) * 100),
  );
  readonly daysBarPct = computed(() => {
    const denom = Math.max(1, this.maxDays() > 0 ? this.maxDays() : this.minDays() || 1);
    return Math.min(100, (this.tradingDays() / denom) * 100);
  });
  readonly targetBarPct = computed(() => {
    const t = this.targetPct();
    return Math.min(100, Math.max(0, t ? (this.profitPct() / t) * 100 : 0));
  });
  readonly sparkPoints = computed(() => {
    const series = this.data()?.equitySeries ?? [];
    if (!series.length) return '';
    const w = 640;
    const h = 220;
    const pad = 16;
    const vals = series.map((s) => s.equity);
    const min = Math.min(...vals) * 0.995;
    const max = Math.max(...vals) * 1.005;
    const span = Math.max(1e-6, max - min);
    return vals
      .map((v, i) => {
        const x = pad + (i / Math.max(1, vals.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / span) * (h - pad * 2);
        return `${x},${y}`;
      })
      .join(' ');
  });

  async confirmArchive() {
    this.archiveBusy.set(true);
    try {
      await this.api.request(`/api/challenges/${this.challengeId()}/archive`, {
        method: 'POST',
        body: '{}',
      });
      this.archiveOpen.set(false);
      this.archived.emit();
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'Archive failed');
      this.archiveOpen.set(false);
    } finally {
      this.archiveBusy.set(false);
    }
  }

  async simulate() {
    const d = this.data();
    if (!d || this.disabled() || d.account?.locked) return;
    this.msg.set('');
    this.err.set('');
    try {
      const res = await this.api.request<{
        equity?: number;
        challengeStatus?: string;
        tradingDays?: number;
        nextChallengeId?: string | null;
        risk?: { kind?: string; rule?: string };
        challenge?: { status?: string; progress?: { equity?: number }; equity?: number };
      }>(`/api/challenges/${this.challengeId()}/trades/simulate`, {
        method: 'POST',
        body: JSON.stringify({
          pnl: Number(this.pnl),
          symbol: 'EURUSD',
          side: 'buy',
          lots: 1,
          tradeDay: this.tradeDay || undefined,
        }),
      });
      const equity = res.equity ?? res.challenge?.progress?.equity ?? res.challenge?.equity;
      const status = res.challengeStatus ?? res.challenge?.status;
      const risk = res.risk?.kind
        ? ` · ${res.risk.kind}${res.risk.rule ? `/${res.risk.rule}` : ''}`
        : '';
      const days = res.tradingDays != null ? ` · days ${res.tradingDays}` : '';
      this.msg.set(`Trade recorded · equity ${moneyPlain(equity)} · ${status}${days}${risk}`);
      if (res.nextChallengeId) {
        this.msg.set(
          `Phase passed · new account ready. Opening ${res.nextChallengeId.slice(0, 8)}…`,
        );
        await this.router.navigate(['/accounts', res.nextChallengeId]);
        return;
      }
      await this.load();
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : 'simulate failed');
    }
  }

  private async load() {
    const id = this.challengeId();
    if (!id) return;
    this.err.set('');
    try {
      const d = await this.api.request<Detail>(`/api/challenges/${id}`);
      this.data.set({
        ...d,
        equitySeries: Array.isArray(d.equitySeries) ? d.equitySeries : [],
        progress: d.progress ?? {
          equity: d.accountSize,
          maxEquity: d.accountSize,
          targetEquity: d.accountSize,
          targetPct: d.profitTargetPct,
          profitPct: 0,
          tradingDays: 0,
          minTradingDays: d.minTradingDays,
          maxTradingDays: d.maxTradingDays ?? 0,
          dayPnl: 0,
        },
      });
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : String(e));
    }
  }
}

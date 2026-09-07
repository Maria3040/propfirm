'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, getSession } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CopyValue } from '@/components/CopyValue';
import {
  money,
  moneyPlain,
  phaseLabel,
  statusClass,
  tradingDisabled,
  typeLabel,
} from '@/lib/accounts-format';

type Detail = {
  id: string;
  sku: string;
  status: string;
  accountSize: number;
  currentPhase: number;
  phases: number;
  profitTargetPct: number;
  hasProfitTarget?: boolean;
  dailyLossPct?: number;
  maxLossPct?: number;
  maxDailyLossPct: number;
  maxTotalLossPct: number;
  minTradingDays: number;
  maxTradingDays?: number;
  failReason?: string | null;
  createdAt?: string;
  account: {
    login: string;
    password: string;
    platform: string;
    server: string;
    equity: number;
    startingBalance: number;
    highWaterMark: number;
    locked: boolean;
  } | null;
  progress: {
    equity: number;
    maxEquity: number;
    targetEquity: number | null;
    targetPct: number;
    hasProfitTarget?: boolean;
    profitPct: number;
    tradingDays: number;
    minTradingDays: number;
    maxTradingDays?: number;
    dayPnl: number;
    dailyCap?: number;
    dailyLossRemaining?: number;
    maxLossRemaining?: number;
  };
  equitySeries: { t: string; equity: number; dayPnl: number }[];
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

function Sparkline({ series }: { series?: { equity: number }[] | null }) {
  const w = 640;
  const h = 220;
  const pad = 16;
  const points = series ?? [];
  if (!points.length) {
    return (
      <div className="acc-chart-empty">
        <span>No equity history yet</span>
      </div>
    );
  }
  const vals = points.map((s) => s.equity);
  const min = Math.min(...vals) * 0.995;
  const max = Math.max(...vals) * 1.005;
  const span = Math.max(1e-6, max - min);
  const coords = vals
    .map((v, i) => {
      const x = pad + (i / Math.max(1, vals.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg className="acc-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={coords} />
    </svg>
  );
}

function Gauge({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  return (
    <div className="acc-gauge">
      <div className="acc-gauge-ring" style={{ ['--p' as string]: `${pct}%` }}>
        <strong>{Math.round(pct)}%</strong>
      </div>
      <div className="acc-gauge-meta">
        <span>{label}</span>
        <em>Max</em>
      </div>
    </div>
  );
}

export default function AccountDetailPanel({
  challengeId,
  onArchived,
}: {
  challengeId: string;
  onArchived?: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [credOpen, setCredOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [pnl, setPnl] = useState('200');
  const [tradeDay, setTradeDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState('');
  const session = getSession();
  const accountEmail = session?.email || '—';

  const load = useCallback(() => {
    setErr('');
    api<Detail>(`/api/challenges/${challengeId}`)
      .then((d) =>
        setData({
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
        }),
      )
      .catch((e) => setErr(String(e.message || e)));
  }, [challengeId]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  async function confirmArchive() {
    setArchiveBusy(true);
    try {
      await api(`/api/challenges/${challengeId}/archive`, { method: 'POST', body: '{}' });
      setArchiveOpen(false);
      onArchived?.();
      load();
    } catch (e: any) {
      setErr(e.message || 'Archive failed');
      setArchiveOpen(false);
    } finally {
      setArchiveBusy(false);
    }
  }

  async function simulate(e: FormEvent) {
    e.preventDefault();
    if (!data || tradingDisabled(data.status) || data.account?.locked) return;
    setMsg('');
    setErr('');
    try {
      const res = await api<any>(`/api/challenges/${challengeId}/trades/simulate`, {
        method: 'POST',
        body: JSON.stringify({
          pnl: Number(pnl),
          symbol: 'EURUSD',
          side: 'buy',
          lots: 1,
          tradeDay: tradeDay || undefined,
        }),
      });
      const equity = res.equity ?? res.challenge?.progress?.equity ?? res.challenge?.equity;
      const status = res.challengeStatus ?? res.challenge?.status;
      const risk = res.risk?.kind ? ` · ${res.risk.kind}${res.risk.rule ? `/${res.risk.rule}` : ''}` : '';
      const days = res.tradingDays != null ? ` · days ${res.tradingDays}` : '';
      setMsg(`Trade recorded · equity ${moneyPlain(equity)} · ${status}${days}${risk}`);
      load();
    } catch (ex: any) {
      setErr(ex.message || 'simulate failed');
    }
  }

  const score = useMemo(() => {
    if (!data) return 0;
    const wr = Math.min(100, Math.max(0, 50 + (data.progress?.profitPct ?? 0) * 2));
    return Math.round(wr * 10) / 10;
  }, [data]);

  if (err && !data) {
    return (
      <div className="acc-detail-empty">
        <p className="err">{err}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="acc-detail-empty">
        <p className="meta">Loading account…</p>
      </div>
    );
  }

  const equity = data.progress?.equity ?? data.account?.equity ?? data.accountSize;
  const size = data.accountSize;
  const pnlTotal = equity - size;
  const maxEq = data.progress?.maxEquity || Math.max(equity, size);
  const disabled = tradingDisabled(data.status) || data.account?.locked;
  const type = typeLabel(data.sku);
  const phase = phaseLabel(data);
  const login = data.account?.login || data.id.slice(0, 9);
  const dailyCap = data.progress?.dailyCap ?? size * ((data.maxDailyLossPct || data.dailyLossPct || 5) / 100);
  const totalCap = size * ((data.maxTotalLossPct || data.maxLossPct || 10) / 100);
  const dayPnl = data.progress?.dayPnl ?? 0;
  const profitPct = data.progress?.profitPct ?? 0;
  const targetPct = Number(data.progress?.targetPct ?? data.profitTargetPct ?? 0) || 0;
  const hasProfitTarget = data.progress?.hasProfitTarget ?? data.hasProfitTarget ?? targetPct > 0;
  const tradingDays = data.progress?.tradingDays ?? 0;
  const minDays = data.minTradingDays ?? data.progress?.minTradingDays ?? 0;
  const maxDays = data.maxTradingDays ?? data.progress?.maxTradingDays ?? 0;
  const dailyRemain =
    data.progress?.dailyLossRemaining ?? Math.max(0, dailyCap + Math.min(0, dayPnl));
  const totalRemain =
    data.progress?.maxLossRemaining ?? Math.max(0, equity - (size - totalCap));
  const canSimulate =
    (data.status === 'Active' || data.status === 'Funded') && !data.account?.locked;
  const minDaysMet = minDays <= 0 || tradingDays >= minDays;
  const maxDaysOk = maxDays <= 0 || tradingDays <= maxDays;

  return (
    <div className="acc-detail">
      <nav className="acc-crumbs" aria-label="breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">›</span>
        <Link href="/accounts">Accounts</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">#{login}</span>
      </nav>

      {disabled ? (
        <div className="acc-alert" role="status">
          <strong>Trading Disabled</strong>
          <p>{data.failReason || 'Trading is currently disabled for this account.'}</p>
        </div>
      ) : null}

      <header className="acc-detail-head">
        <div>
          <div className="acc-detail-brand">
            <span className="acc-logo-mark" aria-hidden="true">
              PF
            </span>
            <span className="acc-detail-login">#{login}</span>
            <span className="acc-detail-created">Created {fmtDate(data.createdAt)}</span>
          </div>
          <div className="acc-detail-pills">
            <span className={statusClass(data.status)}>{data.status}</span>
            <span className="acc-pill">{type}</span>
            <span className="acc-pill">{phase}</span>
            <span className="acc-pill">{platformLabel(data.account?.platform)}</span>
          </div>
        </div>
        <div className="acc-detail-actions">
          <button type="button" className="acc-btn-outline" onClick={() => setCredOpen(true)}>
            Credentials
          </button>
          {!['Closed', 'Cancelled'].includes(data.status) ? (
            <button type="button" className="acc-btn-outline" onClick={() => setArchiveOpen(true)}>
              Archive
            </button>
          ) : null}
        </div>
      </header>

      <div className="acc-metric-grid">
        <div className="acc-metric-card">
          <span>Account Size</span>
          <strong>{moneyPlain(size)}</strong>
        </div>
        <div className="acc-metric-card">
          <span>Today&apos;s Profit</span>
          <strong className={dayPnl >= 0 ? 'up' : 'down'}>{money(dayPnl)}</strong>
        </div>
        <div className="acc-metric-card">
          <span>Equity</span>
          <strong>{moneyPlain(equity)}</strong>
        </div>
        <div className="acc-metric-card">
          <span>Total P&amp;L</span>
          <strong className={pnlTotal >= 0 ? 'up' : 'down'}>{money(pnlTotal)}</strong>
        </div>
      </div>

      <div className="acc-score-row">
        <div className="acc-score-card">
          <div className="acc-score-label">Score</div>
          <div className="acc-score-value">{score}</div>
          <div className="acc-score-axes">
            <span>Consistency</span>
            <span>WR</span>
            <span>RR</span>
            <span>SL</span>
          </div>
        </div>
        <div className="acc-gauges-card">
          <Gauge label="Balance" value={equity} max={maxEq} />
          <Gauge
            label="Equity"
            value={equity}
            max={Math.max(maxEq, Number(data.progress?.targetEquity) || size)}
          />
        </div>
      </div>

      <section className="acc-section">
        <div className="acc-section-head">
          <span>Account Balance</span>
        </div>
        <div className="acc-chart-wrap">
          <Sparkline series={data.equitySeries ?? []} />
        </div>
      </section>

      <div className="acc-metric-grid">
        <div className="acc-metric-card">
          <span>Profit %</span>
          <strong className={profitPct >= 0 ? 'up' : 'down'}>
            {profitPct >= 0 ? '+' : ''}
            {profitPct.toFixed(1)}%
          </strong>
        </div>
        {hasProfitTarget ? (
          <div className="acc-metric-card">
            <span>Target</span>
            <strong>{targetPct}%</strong>
          </div>
        ) : (
          <div className="acc-metric-card">
            <span>Target</span>
            <strong>None</strong>
          </div>
        )}
        <div className="acc-metric-card">
          <span>Trading Days</span>
          <strong>
            {tradingDays}
            {minDays > 0 ? ` / min ${minDays}` : ''}
            {maxDays > 0 ? ` / max ${maxDays}` : ''}
          </strong>
        </div>
        <div className="acc-metric-card">
          <span>Phase</span>
          <strong>
            {data.status === 'Funded' ? 'Funded' : `${data.currentPhase} / ${data.phases}`}
          </strong>
        </div>
      </div>

      <section className="acc-section">
        <span className="acc-section-title">Trading Objectives</span>
        <div className="acc-rules">
          <div className="acc-rule">
            <div className="acc-rule-top">
              <span>Maximum Daily Loss</span>
              <span>Remaining: {moneyPlain(dailyRemain)}</span>
            </div>
            <p className="meta">
              Max allowed {moneyPlain(dailyCap)} · Today&apos;s PnL {money(dayPnl)} · Updates with
              today&apos;s PnL
            </p>
            <div className="acc-rule-bar">
              <span
                style={{
                  width: `${Math.min(100, (Math.abs(Math.min(0, dayPnl)) / Math.max(1, dailyCap)) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="acc-rule">
            <div className="acc-rule-top">
              <span>Maximum Loss</span>
              <span>Remaining: {moneyPlain(totalRemain)}</span>
            </div>
            <p className="meta">
              Max allowed {moneyPlain(totalCap)} · Balance threshold {moneyPlain(size - totalCap)}
            </p>
            <div className="acc-rule-bar">
              <span
                style={{
                  width: `${Math.min(100, (Math.max(0, size - equity) / Math.max(1, totalCap)) * 100)}%`,
                }}
              />
            </div>
          </div>
          {(minDays > 0 || maxDays > 0) && (
            <div className="acc-rule">
              <div className="acc-rule-top">
                <span>Trading Days</span>
                <span>
                  {tradingDays}
                  {minDays > 0 ? ` / min ${minDays}` : ''}
                  {maxDays > 0 ? ` · max ${maxDays}` : ''}
                </span>
              </div>
              <p className="meta">
                {minDays > 0
                  ? minDaysMet
                    ? 'Minimum trading days met.'
                    : `Need ${minDays - tradingDays} more trading day(s) before profit target can pass.`
                  : null}
                {maxDays > 0
                  ? maxDaysOk
                    ? ` ${maxDays - tradingDays} day(s) left before max trading days.`
                    : ' Max trading days exceeded — account should breach.'
                  : null}
              </p>
              <div className="acc-rule-bar">
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      (tradingDays / Math.max(1, maxDays > 0 ? maxDays : minDays || 1)) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
          {hasProfitTarget ? (
            <div className="acc-rule">
              <div className="acc-rule-top">
                <span>Profit Target</span>
                <span>
                  {profitPct.toFixed(1)}% / {targetPct}%
                </span>
              </div>
              <div className="acc-rule-bar">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, targetPct ? (profitPct / targetPct) * 100 : 0))}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {canSimulate ? (
        <form className="acc-sim card stack" onSubmit={simulate}>
          <h3>Simulate trade</h3>
          <label>
            PnL ($)
            <input value={pnl} onChange={(e) => setPnl(e.target.value)} disabled={disabled} />
          </label>
          <label>
            Trade day
            <input
              type="date"
              value={tradeDay}
              onChange={(e) => setTradeDay(e.target.value)}
              disabled={disabled}
            />
          </label>
          <p className="meta">
            Pick another date to accumulate trading days (min {minDays || 0}
            {maxDays > 0 ? `, max ${maxDays}` : ''}). Daily loss uses that day&apos;s PnL.
          </p>
          <button className="btn" type="submit" disabled={disabled}>
            Execute simulated trade
          </button>
          {msg ? <p className="meta">{msg}</p> : null}
        </form>
      ) : null}

      {err ? <p className="err">{err}</p> : null}

      <ConfirmDialog
        open={archiveOpen}
        title="Archive this account?"
        description={`#${login} will be closed and trading disabled. You can still find it under Show Archived.`}
        confirmLabel="Archive"
        danger
        busy={archiveBusy}
        onCancel={() => !archiveBusy && setArchiveOpen(false)}
        onConfirm={() => void confirmArchive()}
      />

      {credOpen ? (
        <div className="acc-modal-backdrop" role="presentation" onClick={() => setCredOpen(false)}>
          <div
            className="acc-cred-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="acc-cred-title"
            aria-describedby="acc-cred-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="acc-cred-header">
              <h2 id="acc-cred-title">Account Credentials</h2>
              <p id="acc-cred-desc" className="meta">
                #{login}
              </p>
            </div>
            <div className="acc-cred-body">
              {data.account ? (
                <>
                  <dl>
                    <div>
                      <dt>Account Username</dt>
                      <CopyValue value={accountEmail} label="Account Username" />
                    </div>
                  </dl>
                  <dl>
                    <div>
                      <dt>Account</dt>
                      <CopyValue value={login} label="Account" />
                    </div>
                  </dl>
                  <dl>
                    <div>
                      <dt>Password</dt>
                      <CopyValue value={data.account.password} label="Password" />
                    </div>
                  </dl>
                  <dl>
                    <div>
                      <dt>Investor Password</dt>
                      <dd className="acc-cred-value">
                        <span>—</span>
                      </dd>
                    </div>
                  </dl>
                  <dl>
                    <div>
                      <dt>Server</dt>
                      <CopyValue value={data.account.server || 'PropFirm-Demo'} label="Server" />
                    </div>
                  </dl>
                  <dl>
                    <div>
                      <dt>Platform</dt>
                      <dd className="acc-cred-value">
                        <span>{platformLabel(data.account.platform)}</span>
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="meta">No trading account provisioned yet.</p>
              )}
            </div>
            <div className="acc-cred-footer">
              <a href="https://help.fundingpips.com/en/collections/12032232-how-to-log-in-to-our-trading-platforms">
                Having trouble logging in?
              </a>
              <a
                href="https://mtr-competition.fundingpips.com"
                rel="noopener noreferrer"
                target="_blank"
                className="acc-cred-platform-link"
              >
                Open MatchTrader
              </a>
            </div>
            <button type="button" className="acc-cred-close" aria-label="Close" onClick={() => setCredOpen(false)}>
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

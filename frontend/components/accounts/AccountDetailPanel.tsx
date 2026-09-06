'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
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
  maxDailyLossPct: number;
  maxTotalLossPct: number;
  minTradingDays: number;
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
    targetEquity: number;
    targetPct: number;
    profitPct: number;
    tradingDays: number;
    minTradingDays: number;
    dayPnl: number;
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
  const range = Math.max(1, max - min);
  const pts = vals
    .map((v, i) => {
      const x = pad + (i / Math.max(1, vals.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  const last = vals[vals.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="acc-spark" role="img" aria-label="Equity chart">
      <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={pts} />
      <text x={pad} y={h - 4} fontSize="11" fill="currentColor" opacity="0.45">
        {moneyPlain(min)}
      </text>
      <text x={w - pad} y={20} fontSize="11" fill="currentColor" opacity="0.45" textAnchor="end">
        {moneyPlain(max)}
      </text>
      <text x={pad} y={20} fontSize="12" fontWeight="600" fill="currentColor">
        {moneyPlain(last)}
      </text>
    </svg>
  );
}

function Gauge({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div className="acc-gauge">
      <div className="acc-gauge-row">
        <span>{label}</span>
        <strong>{moneyPlain(value)}</strong>
      </div>
      <div className="acc-gauge-track">
        <div className="acc-gauge-fill" style={{ width: `${pct}%` }} />
        <span className="acc-gauge-knob" style={{ left: `calc(${pct}% - 4px)` }} />
      </div>
      <div className="acc-gauge-max">
        <span>{moneyPlain(max)}</span>
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
  const [pnl, setPnl] = useState('200');
  const [msg, setMsg] = useState('');

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

  async function archive() {
    if (!confirm('Archive this account? Trading will be disabled.')) return;
    try {
      await api(`/api/challenges/${challengeId}/archive`, { method: 'POST', body: '{}' });
      onArchived?.();
      load();
    } catch (e: any) {
      setErr(e.message || 'Archive failed');
    }
  }

  async function simulate(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      const res = await api<any>(`/api/challenges/${challengeId}/trades/simulate`, {
        method: 'POST',
        body: JSON.stringify({ pnl: Number(pnl), symbol: 'EURUSD', side: 'buy', lots: 1 }),
      });
      setMsg(`Trade recorded · equity ${moneyPlain(res.equity)} · ${res.challengeStatus}`);
      load();
    } catch (ex: any) {
      setErr(ex.message || 'simulate failed');
    }
  }

  const score = useMemo(() => {
    if (!data) return 0;
    const wr = Math.min(100, Math.max(0, 50 + data.progress.profitPct * 2));
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

  const equity = data.progress.equity;
  const size = data.accountSize;
  const pnlTotal = equity - size;
  const maxEq = data.progress.maxEquity || Math.max(equity, size);
  const disabled = tradingDisabled(data.status) || data.account?.locked;
  const type = typeLabel(data.sku);
  const phase = phaseLabel(data);
  const login = data.account?.login || data.id.slice(0, 9);
  const dailyCap = size * ((data.maxDailyLossPct || 5) / 100);
  const totalCap = size * ((data.maxTotalLossPct || 10) / 100);
  const dailyRemain = Math.max(0, dailyCap + Math.min(0, data.progress.dayPnl));
  const totalRemain = Math.max(0, equity - (size - totalCap));

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
          <p>
            {data.failReason ||
              'Trading is currently disabled for this account.'}
          </p>
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
            <span className="acc-pill">{data.account?.platform || 'MT5'}</span>
          </div>
        </div>
        <div className="acc-detail-actions">
          <button type="button" className="acc-btn-outline" onClick={() => setCredOpen(true)}>
            Credentials
          </button>
          {!['Closed', 'Cancelled'].includes(data.status) ? (
            <button type="button" className="acc-btn-outline" onClick={archive}>
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
          <strong className={data.progress.dayPnl >= 0 ? 'up' : 'down'}>
            {money(data.progress.dayPnl)}
          </strong>
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
          <Gauge label="Equity" value={equity} max={Math.max(maxEq, data.progress.targetEquity)} />
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
          <strong className={data.progress.profitPct >= 0 ? 'up' : 'down'}>
            {data.progress.profitPct >= 0 ? '+' : ''}
            {data.progress.profitPct.toFixed(1)}%
          </strong>
        </div>
        <div className="acc-metric-card">
          <span>Target</span>
          <strong>{data.progress.targetPct}%</strong>
        </div>
        <div className="acc-metric-card">
          <span>Trading Days</span>
          <strong>
            {data.progress.tradingDays} / {data.minTradingDays}
          </strong>
        </div>
        <div className="acc-metric-card">
          <span>Phase</span>
          <strong>
            {data.currentPhase} / {data.phases}
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
              Max allowed {moneyPlain(dailyCap)} · Today&apos;s PnL {money(data.progress.dayPnl)} ·
              Threshold {moneyPlain(equity - dailyCap)}
            </p>
            <div className="acc-rule-bar">
              <span
                style={{
                  width: `${Math.min(100, (Math.abs(Math.min(0, data.progress.dayPnl)) / dailyCap) * 100)}%`,
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
                  width: `${Math.min(100, (Math.max(0, size - equity) / totalCap) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="acc-rule">
            <div className="acc-rule-top">
              <span>Profit Target</span>
              <span>
                {data.progress.profitPct.toFixed(1)}% / {data.progress.targetPct}%
              </span>
            </div>
            <div className="acc-rule-bar">
              <span
                style={{
                  width: `${Math.min(100, Math.max(0, (data.progress.profitPct / data.progress.targetPct) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {data.status === 'Active' ? (
        <form className="acc-sim card stack" onSubmit={simulate}>
          <h3>Simulate trade</h3>
          <label>
            PnL ($)
            <input value={pnl} onChange={(e) => setPnl(e.target.value)} />
          </label>
          <button className="btn" type="submit">
            Execute simulated trade
          </button>
          {msg ? <p className="meta">{msg}</p> : null}
        </form>
      ) : null}

      {err ? <p className="err">{err}</p> : null}

      {credOpen ? (
        <div className="acc-modal-backdrop" role="presentation" onClick={() => setCredOpen(false)}>
          <div
            className="acc-modal"
            role="dialog"
            aria-label="Trading credentials"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Credentials</h3>
            {data.account ? (
              <dl className="acc-cred-dl">
                <div>
                  <dt>Login</dt>
                  <dd>{data.account.login}</dd>
                </div>
                <div>
                  <dt>Password</dt>
                  <dd>{data.account.password}</dd>
                </div>
                <div>
                  <dt>Server</dt>
                  <dd>{data.account.server}</dd>
                </div>
                <div>
                  <dt>Platform</dt>
                  <dd>{data.account.platform}</dd>
                </div>
              </dl>
            ) : (
              <p className="meta">No trading account provisioned yet.</p>
            )}
            <button type="button" className="btn" onClick={() => setCredOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

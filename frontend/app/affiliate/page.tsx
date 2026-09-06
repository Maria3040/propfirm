'use client';

import { useMemo, useState } from 'react';
import {
  AFFILIATE_CODE,
  AFFILIATE_REFERRALS,
  AFFILIATE_REWARDS,
  AFFILIATE_STATS,
  EARNINGS_SERIES,
  affiliateReferralUrl,
  formatMoney,
  formatShortDate,
} from '@/lib/affiliate-data';

type MainTab = 'earnings' | 'rewards';
type ViewMode = 'overview' | 'daily';
type ChartMode = 'cumulative' | 'daily';

function CopyIcon() {
  return (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="40" height="40" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M240,56v64a8,8,0,0,1-16,0V75.31l-82.34,82.35a8,8,0,0,1-11.32,0L96,123.31,29.66,189.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0L136,140.69,212.69,64H168a8,8,0,0,1,0-16h64A8,8,0,0,1,240,56Z" />
    </svg>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function EarningsChart({ mode }: { mode: ChartMode }) {
  const series = EARNINGS_SERIES;
  const values = series.map((p) => (mode === 'cumulative' ? p.cumulative : p.amount));
  const max = Math.max(...values, 1);
  const w = 640;
  const h = 280;
  const pad = { t: 24, r: 16, b: 36, l: 48 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  const points = values.map((v, i) => {
    const x = pad.l + (i / Math.max(values.length - 1, 1)) * iw;
    const y = pad.t + ih - (v / max) * ih;
    return { x, y, v, label: formatShortDate(series[i].date) };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${path} L${points[points.length - 1].x},${pad.t + ih} L${points[0].x},${pad.t + ih} Z`;

  if (values.every((v) => v === 0)) {
    return (
      <div className="aff-chart-empty">
        <TrendIcon />
        <p className="aff-chart-empty-title">No referral data available</p>
        <p className="aff-chart-empty-sub">Start referring users to see your earnings history</p>
      </div>
    );
  }

  return (
    <svg className="aff-chart-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Affiliate earnings chart">
      <rect x="0" y="0" width={w} height={h} rx="14" className="aff-chart-bg" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.t + ih - t * ih;
        return (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} className="aff-chart-grid" />
            <text x={pad.l - 8} y={y + 4} textAnchor="end" className="aff-chart-tick">
              {formatMoney(max * t).replace(/\.00$/, '')}
            </text>
          </g>
        );
      })}
      <path d={area} className="aff-chart-area" />
      <path d={path} className="aff-chart-line" fill="none" />
      {points.map((p, i) =>
        i % 3 === 0 || i === points.length - 1 ? (
          <text key={i} x={p.x} y={h - 12} textAnchor="middle" className="aff-chart-tick">
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export default function AffiliatePage() {
  const [mainTab, setMainTab] = useState<MainTab>('earnings');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [chartMode, setChartMode] = useState<ChartMode>('cumulative');
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const referralUrl = useMemo(() => {
    if (typeof window === 'undefined') return affiliateReferralUrl();
    return affiliateReferralUrl(window.location.origin);
  }, []);

  const filteredReferrals = useMemo(() => {
    return AFFILIATE_REFERRALS.filter((r) => {
      if (dateFrom && r.joinedAt < dateFrom) return false;
      if (dateTo && r.joinedAt > dateTo) return false;
      return true;
    });
  }, [dateFrom, dateTo]);

  const onCopy = async (kind: 'link' | 'code', value: string) => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    }
  };

  return (
    <div className="aff-page">
      <header className="aff-heading">
        <div className="aff-heading-row">
          <div className="aff-brand-lockup" aria-hidden>
            <span className="aff-brand-mark">PF</span>
            <span className="aff-brand-name">PropFirm</span>
          </div>
          <div className="aff-heading-rule" />
          <h1>Affiliate</h1>
        </div>
      </header>

      <div className="aff-tabs" role="tablist" aria-label="Affiliate">
        <button
          type="button"
          role="tab"
          id="affiliate-earnings-tab"
          aria-controls="affiliate-earnings-panel"
          aria-selected={mainTab === 'earnings'}
          className={mainTab === 'earnings' ? 'on' : undefined}
          onClick={() => setMainTab('earnings')}
        >
          Earnings
        </button>
        <button
          type="button"
          role="tab"
          id="affiliate-rewards-tab"
          aria-controls="affiliate-rewards-panel"
          aria-selected={mainTab === 'rewards'}
          className={mainTab === 'rewards' ? 'on' : undefined}
          onClick={() => setMainTab('rewards')}
        >
          Rewards
        </button>
      </div>

      {mainTab === 'earnings' ? (
        <div
          role="tabpanel"
          id="affiliate-earnings-panel"
          aria-labelledby="affiliate-earnings-tab"
          className="aff-panel"
        >
          <section className="aff-card">
            <h2>Referral Code</h2>
            <p className="aff-card-desc">Share your referral link or code to earn commissions.</p>
            <div className="aff-copy-row">
              <button
                type="button"
                className="aff-copy-btn grow"
                onClick={() => onCopy('link', referralUrl)}
              >
                <span className="truncate">{referralUrl}</span>
                <CopyIcon />
              </button>
              <button
                type="button"
                className="aff-copy-btn"
                onClick={() => onCopy('code', AFFILIATE_CODE)}
              >
                {AFFILIATE_CODE}
                <CopyIcon />
              </button>
            </div>
            {copied ? (
              <p className="aff-copied">{copied === 'link' ? 'Link copied' : 'Code copied'}</p>
            ) : null}
            <div className="aff-notice">
              <div className="aff-notice-text">
                <AlertIcon />
                <span>Commissions are credited when referred users complete qualifying purchases.</span>
              </div>
              <a
                className="aff-notice-link"
                href="https://app.fundingpips.com/affiliate"
                target="_blank"
                rel="noreferrer"
              >
                Visit Affiliate Page
              </a>
            </div>
          </section>

          <div className="aff-subtabs">
            <button
              type="button"
              className={viewMode === 'overview' ? 'on' : undefined}
              onClick={() => setViewMode('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={viewMode === 'daily' ? 'on' : undefined}
              onClick={() => setViewMode('daily')}
            >
              Daily
            </button>
          </div>

          {viewMode === 'overview' ? (
            <div className="aff-overview">
              <div className="aff-overview-grid">
                <div className="aff-chart-col">
                  <div className="aff-chart-head">
                    <h3>Earnings</h3>
                    <div className="aff-chart-controls">
                      <label className="aff-date-range">
                        <CalendarIcon />
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          aria-label="From date"
                        />
                        <span>–</span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          aria-label="To date"
                        />
                      </label>
                      <button
                        type="button"
                        className={`aff-chip${chartMode === 'cumulative' ? ' primary' : ''}`}
                        onClick={() => setChartMode('cumulative')}
                      >
                        Cumulative
                      </button>
                      <button
                        type="button"
                        className={`aff-chip${chartMode === 'daily' ? ' primary' : ''}`}
                        onClick={() => setChartMode('daily')}
                      >
                        Daily
                      </button>
                    </div>
                  </div>
                  <div className="aff-chart-frame">
                    <EarningsChart mode={chartMode} />
                  </div>
                </div>

                <div className="aff-stats">
                  <div className="aff-stat">
                    <span>Total Referrals</span>
                    <strong>{AFFILIATE_STATS.totalReferrals}</strong>
                  </div>
                  <div className="aff-stat">
                    <span>Total Paid Out</span>
                    <strong>{formatMoney(AFFILIATE_STATS.totalPaidOut)}</strong>
                  </div>
                  <div className="aff-stat">
                    <span>Available Balance</span>
                    <strong>{formatMoney(AFFILIATE_STATS.availableBalance)}</strong>
                  </div>
                </div>
              </div>

              {filteredReferrals.length === 0 ? (
                <div className="aff-empty-list">
                  <p>No referrals found</p>
                  <p>Try adjusting the date range.</p>
                </div>
              ) : (
                <div className="aff-table-wrap">
                  <table className="aff-table">
                    <thead>
                      <tr>
                        <th>Referral</th>
                        <th>Joined</th>
                        <th>Status</th>
                        <th className="end">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReferrals.map((r) => (
                        <tr key={r.id}>
                          <td>{r.email}</td>
                          <td>{formatShortDate(r.joinedAt)}</td>
                          <td>
                            <span className={`aff-status ${r.status}`}>{r.status}</span>
                          </td>
                          <td className="end">{formatMoney(r.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="aff-daily-list">
              <h3>Daily breakdown</h3>
              <ul>
                {[...EARNINGS_SERIES].reverse().map((p) => (
                  <li key={p.date}>
                    <span>{formatShortDate(p.date)}</span>
                    <strong className={p.amount > 0 ? 'pos' : undefined}>
                      {p.amount > 0 ? `+${formatMoney(p.amount)}` : formatMoney(0)}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div
          role="tabpanel"
          id="affiliate-rewards-panel"
          aria-labelledby="affiliate-rewards-tab"
          className="aff-panel"
        >
          <div className="aff-rewards-grid">
            {AFFILIATE_REWARDS.map((rw) => {
              const pct = Math.min(100, Math.round((rw.progress / rw.target) * 100));
              return (
                <article key={rw.id} className={`aff-reward ${rw.status}`}>
                  <div className="aff-reward-top">
                    <h3>{rw.title}</h3>
                    <span className="aff-status">{rw.status.replace('_', ' ')}</span>
                  </div>
                  <p>{rw.description}</p>
                  <div className="aff-progress" aria-hidden>
                    <div style={{ width: `${pct}%` }} />
                  </div>
                  <p className="aff-progress-label">
                    {rw.title === 'Growth' || rw.title === 'Starter'
                      ? `${formatMoney(Math.min(rw.progress, rw.target))} / ${formatMoney(rw.target)}`
                      : `${Math.min(rw.progress, rw.target)} / ${rw.target}`}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

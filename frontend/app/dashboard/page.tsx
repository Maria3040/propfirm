'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getSession } from '@/lib/api';

type Challenge = {
  id: string;
  sku: string;
  status: string;
  accountSize: number;
  currentPhase: number;
  phases: number;
  failReason: string | null;
};

type Wallet = { traderId: string; availableBalance: number };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function sizeLabel(n: number) {
  return n >= 1000 ? `$${n / 1000}k` : `$${n}`;
}

function ScoreRadar() {
  const labels = ['Consistency', 'Calmar', 'Trades', 'SL', 'WR', 'RR', 'Daily'];
  const cx = 100;
  const cy = 100;
  const r = 62;
  const pts = labels.map((_, i) => {
    const a = (-Math.PI / 2) + (i * 2 * Math.PI) / labels.length;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  });
  const poly = pts.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <svg className="td-radar" viewBox="0 0 200 200" aria-hidden="true">
      {pts.map(([x, y], i) => (
        <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="td-radar-axis" />
      ))}
      <polygon points={poly} className="td-radar-ring" />
      <polygon points={`${cx},${cy} ${cx},${cy} ${cx},${cy}`} className="td-radar-fill" />
      {pts.map(([x, y], i) => (
        <circle key={`d-${i}`} cx={x * 0 + cx} cy={y * 0 + cy} r="3.5" className="td-radar-dot" />
      ))}
      {labels.map((label, i) => {
        const a = (-Math.PI / 2) + (i * 2 * Math.PI) / labels.length;
        const lx = cx + Math.cos(a) * (r + 22);
        const ly = cy + Math.sin(a) * (r + 22);
        return (
          <text key={label} x={lx} y={ly} className="td-radar-label" textAnchor="middle" dominantBaseline="middle">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Challenge[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [err, setErr] = useState('');
  const session = typeof window !== 'undefined' ? getSession() : null;

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login?next=/dashboard');
      return;
    }
    Promise.all([
      api<Challenge[]>('/api/challenges'),
      api<Wallet>('/api/payouts/wallet').catch(() => ({ traderId: '', availableBalance: 0 })),
    ])
      .then(([challenges, w]) => {
        setRows(challenges);
        setWallet(w);
      })
      .catch((e) => setErr(String(e.message || e)));
  }, [router]);

  const displayName = session?.displayName || 'Trader';
  const shortName = displayName.split(/\s+/)[0];
  const active = useMemo(
    () => rows.filter((c) => c.status === 'Active' || c.status === 'Funded'),
    [rows],
  );
  const rewardBal = wallet?.availableBalance ?? 0;

  if (!session && !err) {
    return <p className="meta">Redirecting to login…</p>;
  }

  return (
    <div className="td-page">
      <header className="td-head">
        <div>
          <h1>Trade Desk</h1>
          <p>
            {shortName}. Accounts, rewards, risk, and execution in one view.
          </p>
        </div>
        <div className="td-head-actions">
          <span className="td-status">
            <span className="td-status-dot" />
            Active Trader
          </span>
          <button type="button" className="td-share" aria-label="Share">
            Share
          </button>
        </div>
      </header>

      {err && <p className="err">{err}</p>}

      <div className="td-grid-top">
        <article className="td-card td-profile">
          <p className="td-kicker">Profile</p>
          <div className="td-profile-body">
            <div className="td-avatar-wrap">
              <svg className="td-tier-ring" viewBox="0 0 112 112" aria-hidden="true">
                <defs>
                  <linearGradient id="arc-bronze" x1="56" y1="6" x2="56" y2="106">
                    <stop stopColor="#A96535" />
                    <stop offset="1" stopColor="#C5803B" />
                  </linearGradient>
                </defs>
                <path
                  d="M56 0C86.9 0 112 25.1 112 56S86.9 112 56 112 0 86.9 0 56 25.1 0 56 0Zm0 6C28.4 6 6 28.4 6 56s22.4 50 50 50 50-22.4 50-50S83.6 6 56 6Z"
                  fill="currentColor"
                  opacity="0.08"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="53"
                  fill="none"
                  stroke="url(#arc-bronze)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="333"
                  strokeDashoffset="250"
                  transform="rotate(-90 56 56)"
                />
              </svg>
              <div className="td-avatar">{initials(displayName)}</div>
              <div className="td-tier-badge" title="Bronze Tier" aria-hidden="true">
                B
              </div>
            </div>
            <h2>{displayName}</h2>
            <p>Bronze Tier</p>
          </div>
          <div className="td-metrics">
            <div>
              <p>Reward Count</p>
              <strong>0</strong>
            </div>
            <div>
              <p>Rewards Amount</p>
              <strong>${rewardBal.toFixed(2)}</strong>
            </div>
            <div>
              <p>Highest Reward</p>
              <strong>$0.00</strong>
            </div>
          </div>
        </article>

        <article className="td-card td-score">
          <div>
            <p className="td-kicker">Score Index</p>
            <p className="td-score-value">
              <span>0.00</span>
              <span className="td-score-max">/ 100</span>
            </p>
          </div>
          <div className="td-radar-wrap">
            <ScoreRadar />
          </div>
        </article>
      </div>

      <section className="td-section">
        <p className="td-kicker">Active Accounts</p>
        <div className="td-accounts">
          {active.length ? (
            active.map((c) => (
              <Link key={c.id} href={`/accounts/${c.id}`} className="td-card td-account">
                <div className="td-account-top">
                  <strong>{c.sku}</strong>
                  <span className="td-pill">{c.status}</span>
                </div>
                <p>
                  {sizeLabel(c.accountSize)} · Phase {c.currentPhase}/{c.phases}
                </p>
              </Link>
            ))
          ) : (
            <article className="td-card td-empty">
              <p className="td-empty-title">Your funded account awaits</p>
              <p className="td-empty-sub">
                Complete a challenge and trade with up to $200k in capital
              </p>
              <Link href="/" className="td-cta">
                Start a challenge →
              </Link>
            </article>
          )}
        </div>
      </section>

      <section className="td-section">
        <p className="td-kicker">Behavioral Bias</p>
        <article className="td-card td-bias">
          <div className="td-bias-visual" aria-hidden="true" />
          <div className="td-bias-content">
            <div className="td-bias-row">
              <div className="td-bias-side">
                <span className="td-bias-pct">50%</span>
                <div>
                  <p>Bull</p>
                  <p>Long Bias</p>
                </div>
              </div>
              <div className="td-bias-slash">/</div>
              <div className="td-bias-side td-bias-side-end">
                <div>
                  <p>Bear</p>
                  <p>Short Bias</p>
                </div>
                <span className="td-bias-pct">50%</span>
              </div>
            </div>
            <div className="td-bias-bar">
              <div style={{ width: '50%' }} />
            </div>
            <div className="td-bias-labels">
              <span>0</span>
              <span>0</span>
            </div>
          </div>
        </article>
      </section>

      <section className="td-section">
        <p className="td-kicker">Execution Stats</p>
        <div className="td-exec-grid">
          <article className="td-card td-stat">
            <p className="td-kicker">Trading Week Performance</p>
            <div className="td-stat-empty">No trading data this week</div>
          </article>
          <article className="td-card td-stat">
            <p className="td-kicker">Session Win Rates</p>
            {['New York', 'London', 'Asia'].map((s) => (
              <div key={s} className="td-rate-row">
                <div className="td-rate-head">
                  <span>{s}</span>
                  <strong>
                    0<span>.0%</span>
                  </strong>
                </div>
                <div className="td-rate-track">
                  <div style={{ width: '0%' }} />
                </div>
              </div>
            ))}
          </article>
          <article className="td-card td-stat">
            <div className="td-stat-head">
              <p className="td-kicker">Profitability</p>
              <div className="td-stat-right">
                <p>Total Trades</p>
                <strong>0</strong>
              </div>
            </div>
            <div className="td-stat-empty">No trades recorded yet</div>
          </article>
          <article className="td-card td-stat">
            <p className="td-kicker">Most Traded Instruments</p>
            <div className="td-stat-empty">No instruments traded yet</div>
          </article>
        </div>
      </section>

      {rows.some((c) => c.status !== 'Active' && c.status !== 'Funded') && (
        <section className="td-section">
          <p className="td-kicker">All Challenges</p>
          <div className="td-accounts">
            {rows.map((c) => (
              <Link key={c.id} href={`/accounts/${c.id}`} className="td-card td-account">
                <div className="td-account-top">
                  <strong>{c.sku}</strong>
                  <span className="td-pill">{c.status}</span>
                </div>
                <p>
                  {sizeLabel(c.accountSize)} · Phase {c.currentPhase}/{c.phases}
                  {c.failReason ? ` · ${c.failReason}` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

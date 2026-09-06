'use client';

import { useMemo, useState } from 'react';
import {
  ACCOUNT_SIZES,
  LEADERBOARD_TRADERS,
  NOTABLE_RECORDS,
  formatMoney,
  formatPct,
  winRatioTone,
  type AccountSize,
  type LeaderboardTrader,
} from '@/lib/leaderboards-data';

type RankMode = 'profit' | 'rewards';

function FlagBadge({ code }: { code: string }) {
  return (
    <span className="lb-flag" title={code} aria-label={`${code} flag`}>
      {code}
    </span>
  );
}

function WinRatioRing({ ratio }: { ratio: number }) {
  const r = 23.5;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, ratio)) / 100);
  const tone = winRatioTone(ratio);
  const color = tone === 'good' ? '#10b981' : tone === 'mid' ? '#f59e0b' : '#ef4444';

  return (
    <div className="lb-ring" role="img" aria-label={`Win Ratio ${Math.round(ratio)}%`}>
      <svg viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(15,23,32,0.12)" strokeWidth="5" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span>{Math.round(ratio)}%</span>
    </div>
  );
}

function FilterSelector({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="lb-filter" role="group" aria-label={label || 'Filter'}>
      {label ? <p>{label}</p> : null}
      <div className="lb-filter-group">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`lb-chip${value === opt ? ' on' : ''}`}
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function PodiumPlace({ trader, place }: { trader: LeaderboardTrader; place: 1 | 2 | 3 }) {
  return (
    <li className="lb-podium-item">
      <div className="lb-podium-main">
        <span className={`lb-rank r${place}`}>{place}</span>
        <div>
          <div className="lb-name-row">
            <p className="lb-trader-name" title={trader.name}>
              {trader.name}
            </p>
            <FlagBadge code={trader.country} />
          </div>
          <p className="lb-profit">{formatMoney(trader.profit, true)}</p>
          <p className="lb-pct">{formatPct(trader.profitPct)}</p>
          <p className="lb-trades">{trader.trades} Trades</p>
        </div>
      </div>
      <WinRatioRing ratio={trader.winRatio} />
    </li>
  );
}

function WinRatioCell({ ratio }: { ratio: number }) {
  const tone = winRatioTone(ratio);
  const color = tone === 'good' ? '#10b981' : tone === 'mid' ? '#f59e0b' : '#ef4444';
  return (
    <div className="lb-winbar">
      <div className="lb-winbar-track" role="meter" aria-valuenow={ratio} aria-valuemin={0} aria-valuemax={100}>
        <div className="lb-winbar-fill" style={{ width: `${ratio}%`, background: color }} />
      </div>
      <span style={{ minWidth: '3rem', fontVariantNumeric: 'tabular-nums' }}>{ratio.toFixed(1)}%</span>
    </div>
  );
}

export default function LeaderboardsPage() {
  const [currency] = useState('USD');
  const [accountSize, setAccountSize] = useState<AccountSize>('All');
  const [rankMode, setRankMode] = useState<RankMode>('profit');

  const traders = useMemo(() => {
    const filtered =
      accountSize === 'All'
        ? LEADERBOARD_TRADERS
        : LEADERBOARD_TRADERS.filter((t) => t.accountSize === accountSize);
    const sorted = [...filtered].sort((a, b) => {
      if (rankMode === 'rewards') return (b.rewards || 0) - (a.rewards || 0);
      return b.profit - a.profit;
    });
    return sorted.map((t, i) => ({ ...t, rank: i + 1 }));
  }, [accountSize, rankMode]);

  const podium = traders.slice(0, 3);

  return (
    <div className="lb-page">
      <header className="lb-header">
        <div>
          <h1>Leaderboards</h1>
          <p className="lb-live">
            <span className="lb-live-dot" aria-hidden />
            Live standings for the top funded traders.
          </p>
        </div>
        <div className="lb-filters">
          <FilterSelector label="Currency:" options={['USD']} value={currency} onChange={() => undefined} />
          <FilterSelector
            label="Account Size:"
            options={ACCOUNT_SIZES}
            value={accountSize}
            onChange={(v) => setAccountSize(v as AccountSize)}
          />
        </div>
      </header>

      <section aria-labelledby="leaderboard-podium-heading">
        <h2 className="lb-section-label" id="leaderboard-podium-heading">
          Top Traders
        </h2>
        {podium.length === 0 ? (
          <p className="muted">No traders for this filter.</p>
        ) : (
          <ol className="lb-podium">
            {podium.map((t, i) => (
              <PodiumPlace key={t.name} trader={t} place={(i + 1) as 1 | 2 | 3} />
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="leaderboard-records-heading">
        <h2 className="lb-section-label" id="leaderboard-records-heading">
          Notable records
        </h2>
        <div className="lb-records">
          {NOTABLE_RECORDS.map((r) => (
            <div key={r.label} className="lb-record">
              <p className="lb-record-label">{r.label}</p>
              <p className="lb-record-value">{r.value}</p>
              <div className="lb-record-who">
                <FlagBadge code={r.country} />
                <span title={r.name}>{r.name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="leaderboard-ranking-heading">
        <div className="lb-rank-head">
          <h2 className="lb-section-label" id="leaderboard-ranking-heading">
            Full ranking
          </h2>
          <FilterSelector
            options={['Profit', 'Rewards']}
            value={rankMode === 'profit' ? 'Profit' : 'Rewards'}
            onChange={(v) => setRankMode(v === 'Rewards' ? 'rewards' : 'profit')}
          />
        </div>

        <div className="lb-table-wrap">
          <div className="lb-table-scroll">
            <table className="lb-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Trader</th>
                  <th>Country</th>
                  <th className="end">{rankMode === 'rewards' ? 'Rewards' : 'Profit'}</th>
                  <th className="end">Profit %</th>
                  <th>Win Ratio</th>
                  <th>Pair</th>
                  <th className="end">Avg. Win</th>
                  <th className="end">Avg. Loss</th>
                  <th className="end">Avg. Duration</th>
                  <th className="end">Trades</th>
                  <th className="end">Losing Streak</th>
                  <th className="end">Winning Streak</th>
                </tr>
              </thead>
              <tbody>
                {traders.map((t) => (
                  <tr key={`${t.rank}-${t.name}`}>
                    <td>
                      <span
                        className={`lb-rank muted${t.rank <= 3 ? ` r${t.rank}` : ''}`}
                        style={{ width: 'auto', fontSize: '0.875rem' }}
                      >
                        {t.rank}
                      </span>
                    </td>
                    <td>
                      <strong>{t.name}</strong>
                    </td>
                    <td>
                      <FlagBadge code={t.country} />
                    </td>
                    <td className="end">
                      <span className="lb-pos">
                        {rankMode === 'rewards'
                          ? formatMoney(t.rewards || 0, true)
                          : formatMoney(t.profit, true)}
                      </span>
                    </td>
                    <td className="end">
                      <span className="lb-pos">{formatPct(t.profitPct)}</span>
                    </td>
                    <td>
                      <WinRatioCell ratio={t.winRatio} />
                    </td>
                    <td>
                      <span className="lb-pair">{t.pair}</span>
                    </td>
                    <td className="end">
                      <span className="lb-pos">{formatMoney(t.avgWin)}</span>
                    </td>
                    <td className="end">
                      <span className={t.avgLoss < 0 ? 'lb-neg' : 'lb-pos'}>{formatMoney(t.avgLoss, true)}</span>
                    </td>
                    <td className="end">{t.avgDuration}</td>
                    <td className="end">{t.trades}</td>
                    <td className="end">
                      <span className={t.losingStreak > 0 ? 'lb-neg' : 'lb-pos'}>{t.losingStreak}</span>
                    </td>
                    <td className="end">
                      <span className="lb-pos">{t.winningStreak}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="lb-cards">
            {traders.map((t) => (
              <li key={`m-${t.rank}-${t.name}`} className="lb-card">
                <div className="lb-card-left">
                  <span className={`lb-rank muted${t.rank <= 3 ? ` r${t.rank}` : ''}`} style={{ fontSize: '0.875rem' }}>
                    {t.rank}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="lb-name-row">
                      <p className="lb-trader-name" title={t.name}>
                        {t.name}
                      </p>
                      <FlagBadge code={t.country} />
                    </div>
                    <p className="lb-card-meta">
                      Win Ratio {t.winRatio.toFixed(1)}% · {t.trades} Trades
                    </p>
                  </div>
                </div>
                <div className="lb-card-right">
                  <strong>
                    {rankMode === 'rewards'
                      ? formatMoney(t.rewards || 0, true)
                      : formatMoney(t.profit, true)}
                  </strong>
                  <p className="lb-pct">{formatPct(t.profitPct)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

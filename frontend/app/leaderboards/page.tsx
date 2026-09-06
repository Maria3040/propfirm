'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { useFilteredPagination } from '@/lib/list-utils';
import { PageNumberPager } from '@/components/PageNumberPager';

type RankMode = 'profit' | 'rewards';
type SortCol =
  | 'rank'
  | 'name'
  | 'country'
  | 'metric'
  | 'profitPct'
  | 'winRatio'
  | 'pair'
  | 'avgWin'
  | 'avgLoss'
  | 'avgDuration'
  | 'trades'
  | 'losingStreak'
  | 'winningStreak';
type SortDir = 'asc' | 'desc';

const DEFAULT_DIR: Record<SortCol, SortDir> = {
  rank: 'asc',
  name: 'asc',
  country: 'asc',
  metric: 'desc',
  profitPct: 'desc',
  winRatio: 'desc',
  pair: 'asc',
  avgWin: 'desc',
  avgLoss: 'asc',
  avgDuration: 'asc',
  trades: 'desc',
  losingStreak: 'desc',
  winningStreak: 'desc',
};

function parseDurationMinutes(s: string): number {
  const h = /(\d+)\s*h/.exec(s);
  const m = /(\d+)\s*m/.exec(s);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

function SortableTh({
  col,
  label,
  activeCol,
  dir,
  align = 'start',
  onSort,
}: {
  col: SortCol;
  label: string;
  activeCol: SortCol;
  dir: SortDir;
  align?: 'start' | 'end';
  onSort: (col: SortCol) => void;
}) {
  const active = activeCol === col;
  return (
    <th className={align === 'end' ? 'end' : undefined} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`lb-th-btn${active ? ' on' : ''}`} onClick={() => onSort(col)}>
        <span>{label}</span>
        <span className="lb-th-arrow" aria-hidden>
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

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
  const [sortCol, setSortCol] = useState<SortCol>('metric');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sizeScoped = useMemo(() => {
    if (accountSize === 'All') return LEADERBOARD_TRADERS;
    return LEADERBOARD_TRADERS.filter((t) => t.accountSize === accountSize);
  }, [accountSize]);

  const matchTrader = useCallback((t: LeaderboardTrader, q: string) => {
    return (
      t.name.toLowerCase().includes(q) ||
      t.country.toLowerCase().includes(q) ||
      t.pair.toLowerCase().includes(q) ||
      t.accountSize.toLowerCase().includes(q)
    );
  }, []);

  const compare = useMemo(() => {
    const metric = (t: LeaderboardTrader) =>
      rankMode === 'rewards' ? t.rewards || 0 : t.profit;

    const value = (t: LeaderboardTrader): number | string => {
      switch (sortCol) {
        case 'rank':
          return metric(t);
        case 'name':
          return t.name.toLowerCase();
        case 'country':
          return t.country;
        case 'metric':
          return metric(t);
        case 'profitPct':
          return t.profitPct;
        case 'winRatio':
          return t.winRatio;
        case 'pair':
          return t.pair;
        case 'avgWin':
          return t.avgWin;
        case 'avgLoss':
          return t.avgLoss;
        case 'avgDuration':
          return parseDurationMinutes(t.avgDuration);
        case 'trades':
          return t.trades;
        case 'losingStreak':
          return t.losingStreak;
        case 'winningStreak':
          return t.winningStreak;
        default:
          return metric(t);
      }
    };

    return (a: LeaderboardTrader, b: LeaderboardTrader) => {
      const av = value(a);
      const bv = value(b);
      let cmp = 0;
      if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv);
      else cmp = Number(av) - Number(bv);
      // For "rank" column, sort by metric desc when dir asc means best-first (rank 1 first)
      if (sortCol === 'rank') {
        cmp = Number(bv) - Number(av);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    };
  }, [sortCol, sortDir, rankMode]);

  const listState = useFilteredPagination(sizeScoped, matchTrader, {
    initialPageSize: 10,
    compare,
  });

  function onSortColumn(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(DEFAULT_DIR[col]);
    }
    listState.setPage(1);
  }

  /** Global ranks from the full filtered+sorted set (podium uses top 3). */
  const rankedAll = useMemo(() => {
    const q = listState.query.trim().toLowerCase();
    const filtered = !q ? sizeScoped : sizeScoped.filter((t) => matchTrader(t, q));
    const sorted = [...filtered].sort(compare);
    return sorted.map((t, i) => ({ ...t, rank: i + 1 }));
  }, [sizeScoped, listState.query, matchTrader, compare]);

  const podium = rankedAll.slice(0, 3);

  const pageRows = useMemo(
    () =>
      listState.pageItems.map((t, i) => ({
        ...t,
        rank: listState.startIndex + i + 1,
      })),
    [listState.pageItems, listState.startIndex],
  );

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
            onChange={(v) => {
              setAccountSize(v as AccountSize);
              listState.setPage(1);
            }}
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
            onChange={(v) => {
              const next = v === 'Rewards' ? 'rewards' : 'profit';
              setRankMode(next);
              setSortCol('metric');
              setSortDir('desc');
              listState.setPage(1);
            }}
          />
        </div>

        <div className="lb-toolbar">
          <label className="lb-search">
            <span className="sr-only">Search traders</span>
            <input
              type="search"
              placeholder="Filter by name, country, pair…"
              value={listState.query}
              onChange={(e) => listState.setQuery(e.target.value)}
            />
          </label>
          <label className="lb-sort">
            Page size
            <select
              value={listState.pageSize}
              onChange={(e) => listState.setPageSize(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
            </select>
          </label>
          <p className="lb-toolbar-meta">
            {listState.filteredTotal} traders · page {listState.page}/{listState.pageCount}
            {' · '}
            sorted by {sortCol} {sortDir === 'asc' ? '↑' : '↓'} (click column headers)
          </p>
        </div>

        <div className="lb-table-wrap">
          <div className="lb-table-scroll">
            <table className="lb-table">
              <thead>
                <tr>
                  <SortableTh col="rank" label="Rank" activeCol={sortCol} dir={sortDir} onSort={onSortColumn} />
                  <SortableTh col="name" label="Trader" activeCol={sortCol} dir={sortDir} onSort={onSortColumn} />
                  <SortableTh col="country" label="Country" activeCol={sortCol} dir={sortDir} onSort={onSortColumn} />
                  <SortableTh
                    col="metric"
                    label={rankMode === 'rewards' ? 'Rewards' : 'Profit'}
                    activeCol={sortCol}
                    dir={sortDir}
                    align="end"
                    onSort={onSortColumn}
                  />
                  <SortableTh col="profitPct" label="Profit %" activeCol={sortCol} dir={sortDir} align="end" onSort={onSortColumn} />
                  <SortableTh col="winRatio" label="Win Ratio" activeCol={sortCol} dir={sortDir} onSort={onSortColumn} />
                  <SortableTh col="pair" label="Pair" activeCol={sortCol} dir={sortDir} onSort={onSortColumn} />
                  <SortableTh col="avgWin" label="Avg. Win" activeCol={sortCol} dir={sortDir} align="end" onSort={onSortColumn} />
                  <SortableTh col="avgLoss" label="Avg. Loss" activeCol={sortCol} dir={sortDir} align="end" onSort={onSortColumn} />
                  <SortableTh col="avgDuration" label="Avg. Duration" activeCol={sortCol} dir={sortDir} align="end" onSort={onSortColumn} />
                  <SortableTh col="trades" label="Trades" activeCol={sortCol} dir={sortDir} align="end" onSort={onSortColumn} />
                  <SortableTh col="losingStreak" label="Losing Streak" activeCol={sortCol} dir={sortDir} align="end" onSort={onSortColumn} />
                  <SortableTh col="winningStreak" label="Winning Streak" activeCol={sortCol} dir={sortDir} align="end" onSort={onSortColumn} />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="lb-empty-cell">
                      No traders match this filter.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((t) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          <ul className="lb-cards">
            {pageRows.map((t) => (
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

        <PageNumberPager
          page={listState.page}
          pageCount={listState.pageCount}
          pageNumbers={listState.pageNumbers}
          onPageChange={listState.setPage}
        />
      </section>
    </div>
  );
}

import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PageNumberPagerComponent,
  visiblePageNumbers,
} from '../components/page-number-pager.component';
import {
  ACCOUNT_SIZES,
  LEADERBOARD_TRADERS,
  NOTABLE_RECORDS,
  formatMoney,
  formatPct,
  winRatioTone,
  type AccountSize,
  type LeaderboardTrader,
} from '../data/leaderboards-data';

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

@Component({
  selector: 'app-leaderboards-page',
  standalone: true,
  imports: [FormsModule, PageNumberPagerComponent],
  template: `
    <div class="lb-page">
      <header class="lb-header">
        <div>
          <h1>Leaderboards</h1>
          <p class="lb-live">
            <span class="lb-live-dot" aria-hidden="true"></span>
            Live standings for the top funded traders.
          </p>
        </div>
        <div class="lb-filters">
          <div class="lb-filter" role="group" aria-label="Account Size">
            <p>Account Size:</p>
            <div class="lb-filter-group">
              @for (opt of accountSizes; track opt) {
                <button
                  type="button"
                  class="lb-chip"
                  [class.on]="accountSize() === opt"
                  [attr.aria-pressed]="accountSize() === opt"
                  (click)="setSize(opt)"
                >
                  {{ opt }}
                </button>
              }
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="leaderboard-podium-heading">
        <h2 class="lb-section-label" id="leaderboard-podium-heading">Top Traders</h2>
        @if (podium().length === 0) {
          <p class="muted">No traders for this filter.</p>
        } @else {
          <ol class="lb-podium">
            @for (t of podium(); track t.name; let i = $index) {
              <li class="lb-podium-item">
                <div class="lb-podium-main">
                  <span [class]="'lb-rank r' + (i + 1)">{{ i + 1 }}</span>
                  <div>
                    <div class="lb-name-row">
                      <p class="lb-trader-name" [title]="t.name">{{ t.name }}</p>
                      <span class="lb-flag">{{ t.country }}</span>
                    </div>
                    <p class="lb-profit">{{ formatMoney(t.profit, true) }}</p>
                    <p class="lb-pct">{{ formatPct(t.profitPct) }}</p>
                    <p class="lb-trades">{{ t.trades }} Trades</p>
                  </div>
                </div>
                <div class="lb-ring" role="img" [attr.aria-label]="'Win Ratio ' + round(t.winRatio) + '%'">
                  <svg viewBox="0 0 52 52" aria-hidden="true">
                    <circle cx="26" cy="26" [attr.r]="ringR" fill="none" stroke="rgba(15,23,32,0.12)" stroke-width="5" />
                    <circle
                      cx="26"
                      cy="26"
                      [attr.r]="ringR"
                      fill="none"
                      [attr.stroke]="winColor(t.winRatio)"
                      stroke-width="5"
                      stroke-linecap="round"
                      [attr.stroke-dasharray]="ringC"
                      [attr.stroke-dashoffset]="ringOffset(t.winRatio)"
                    />
                  </svg>
                  <span>{{ round(t.winRatio) }}%</span>
                </div>
              </li>
            }
          </ol>
        }
      </section>

      <section aria-labelledby="leaderboard-records-heading">
        <h2 class="lb-section-label" id="leaderboard-records-heading">Notable records</h2>
        <div class="lb-records">
          @for (r of records; track r.label) {
            <div class="lb-record">
              <p class="lb-record-label">{{ r.label }}</p>
              <p class="lb-record-value">{{ r.value }}</p>
              <div class="lb-record-who">
                <span class="lb-flag">{{ r.country }}</span>
                <span [title]="r.name">{{ r.name }}</span>
              </div>
            </div>
          }
        </div>
      </section>

      <section aria-labelledby="leaderboard-ranking-heading">
        <div class="lb-rank-head">
          <h2 class="lb-section-label" id="leaderboard-ranking-heading">Full ranking</h2>
          <div class="lb-filter" role="group">
            <div class="lb-filter-group">
              <button
                type="button"
                class="lb-chip"
                [class.on]="rankMode() === 'profit'"
                (click)="rankMode.set('profit'); page.set(1)"
              >
                Profit
              </button>
              <button
                type="button"
                class="lb-chip"
                [class.on]="rankMode() === 'rewards'"
                (click)="rankMode.set('rewards'); page.set(1)"
              >
                Rewards
              </button>
            </div>
          </div>
        </div>

        <div class="lb-toolbar">
          <label class="lb-search">
            <span class="sr-only">Search traders</span>
            <input
              type="search"
              placeholder="Filter by name, country, pair…"
              [ngModel]="query()"
              (ngModelChange)="query.set($event); page.set(1)"
            />
          </label>
          <label class="lb-sort">
            Page size
            <select [ngModel]="pageSize()" (ngModelChange)="pageSize.set(+$event); page.set(1)">
              <option [ngValue]="5">5</option>
              <option [ngValue]="10">10</option>
              <option [ngValue]="20">20</option>
              <option [ngValue]="40">40</option>
            </select>
          </label>
          <p class="lb-toolbar-meta">
            {{ filtered().length }} traders · page {{ page() }}/{{ pageCount() }} · sorted by
            {{ sortCol() }} {{ sortDir() === 'asc' ? '↑' : '↓' }} (click column headers)
          </p>
        </div>

        <div class="lb-table-wrap">
          <div class="lb-table-scroll">
            <table class="lb-table">
              <thead>
                <tr>
                  @for (col of columns; track col.key) {
                    <th
                      [class.end]="col.align === 'end'"
                      [attr.aria-sort]="
                        sortCol() === col.key
                          ? sortDir() === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      "
                    >
                      <button
                        type="button"
                        class="lb-th-btn"
                        [class.on]="sortCol() === col.key"
                        (click)="onSortColumn(col.key)"
                      >
                        <span>{{
                          col.key === 'metric'
                            ? rankMode() === 'rewards'
                              ? 'Rewards'
                              : 'Profit'
                            : col.label
                        }}</span>
                        <span class="lb-th-arrow" aria-hidden="true">
                          {{ sortCol() === col.key ? (sortDir() === 'asc' ? '↑' : '↓') : '↕' }}
                        </span>
                      </button>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @if (pageRows().length === 0) {
                  <tr>
                    <td colspan="13" class="lb-empty-cell">No traders match this filter.</td>
                  </tr>
                } @else {
                  @for (t of pageRows(); track t.rank + t.name) {
                    <tr>
                      <td>
                        <span
                          [class]="'lb-rank muted' + (t.rank <= 3 ? ' r' + t.rank : '')"
                          style="width:auto;font-size:0.875rem"
                          >{{ t.rank }}</span
                        >
                      </td>
                      <td><strong>{{ t.name }}</strong></td>
                      <td><span class="lb-flag">{{ t.country }}</span></td>
                      <td class="end">
                        <span class="lb-pos">
                          {{
                            rankMode() === 'rewards'
                              ? formatMoney(t.rewards || 0, true)
                              : formatMoney(t.profit, true)
                          }}
                        </span>
                      </td>
                      <td class="end"><span class="lb-pos">{{ formatPct(t.profitPct) }}</span></td>
                      <td>
                        <div class="lb-winbar">
                          <div
                            class="lb-winbar-track"
                            role="meter"
                            [attr.aria-valuenow]="t.winRatio"
                            aria-valuemin="0"
                            aria-valuemax="100"
                          >
                            <div
                              class="lb-winbar-fill"
                              [style.width.%]="t.winRatio"
                              [style.background]="winColor(t.winRatio)"
                            ></div>
                          </div>
                          <span style="min-width:3rem;font-variant-numeric:tabular-nums"
                            >{{ t.winRatio.toFixed(1) }}%</span
                          >
                        </div>
                      </td>
                      <td><span class="lb-pair">{{ t.pair }}</span></td>
                      <td class="end"><span class="lb-pos">{{ formatMoney(t.avgWin) }}</span></td>
                      <td class="end">
                        <span [class]="t.avgLoss < 0 ? 'lb-neg' : 'lb-pos'">{{
                          formatMoney(t.avgLoss, true)
                        }}</span>
                      </td>
                      <td class="end">{{ t.avgDuration }}</td>
                      <td class="end">{{ t.trades }}</td>
                      <td class="end">
                        <span [class]="t.losingStreak > 0 ? 'lb-neg' : 'lb-pos'">{{
                          t.losingStreak
                        }}</span>
                      </td>
                      <td class="end"><span class="lb-pos">{{ t.winningStreak }}</span></td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          <ul class="lb-cards">
            @for (t of pageRows(); track 'm-' + t.rank + t.name) {
              <li class="lb-card">
                <div class="lb-card-left">
                  <span
                    [class]="'lb-rank muted' + (t.rank <= 3 ? ' r' + t.rank : '')"
                    style="font-size:0.875rem"
                    >{{ t.rank }}</span
                  >
                  <div style="min-width:0">
                    <div class="lb-name-row">
                      <p class="lb-trader-name" [title]="t.name">{{ t.name }}</p>
                      <span class="lb-flag">{{ t.country }}</span>
                    </div>
                    <p class="lb-card-meta">
                      Win Ratio {{ t.winRatio.toFixed(1) }}% · {{ t.trades }} Trades
                    </p>
                  </div>
                </div>
                <div class="lb-card-right">
                  <strong>
                    {{
                      rankMode() === 'rewards'
                        ? formatMoney(t.rewards || 0, true)
                        : formatMoney(t.profit, true)
                    }}
                  </strong>
                  <p class="lb-pct">{{ formatPct(t.profitPct) }}</p>
                </div>
              </li>
            }
          </ul>
        </div>

        <app-page-number-pager
          [page]="page()"
          [pageCount]="pageCount()"
          [pageNumbers]="pageNumbers()"
          [onPageChange]="setPage"
        />
      </section>
    </div>
  `,
})
export class LeaderboardsPage {
  readonly accountSizes = ACCOUNT_SIZES;
  readonly records = NOTABLE_RECORDS;
  readonly formatMoney = formatMoney;
  readonly formatPct = formatPct;
  readonly ringR = 23.5;
  readonly ringC = 2 * Math.PI * 23.5;

  readonly columns: { key: SortCol; label: string; align?: 'end' }[] = [
    { key: 'rank', label: 'Rank' },
    { key: 'name', label: 'Trader' },
    { key: 'country', label: 'Country' },
    { key: 'metric', label: 'Profit', align: 'end' },
    { key: 'profitPct', label: 'Profit %', align: 'end' },
    { key: 'winRatio', label: 'Win Ratio' },
    { key: 'pair', label: 'Pair' },
    { key: 'avgWin', label: 'Avg. Win', align: 'end' },
    { key: 'avgLoss', label: 'Avg. Loss', align: 'end' },
    { key: 'avgDuration', label: 'Avg. Duration', align: 'end' },
    { key: 'trades', label: 'Trades', align: 'end' },
    { key: 'losingStreak', label: 'Losing Streak', align: 'end' },
    { key: 'winningStreak', label: 'Winning Streak', align: 'end' },
  ];

  readonly accountSize = signal<AccountSize>('All');
  readonly rankMode = signal<RankMode>('profit');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly query = signal('');
  readonly sortCol = signal<SortCol>('metric');
  readonly sortDir = signal<SortDir>('desc');

  readonly sizeScoped = computed(() => {
    const size = this.accountSize();
    if (size === 'All') return LEADERBOARD_TRADERS;
    return LEADERBOARD_TRADERS.filter((t) => t.accountSize === size);
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    let list = this.sizeScoped();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.country.toLowerCase().includes(q) ||
          t.pair.toLowerCase().includes(q) ||
          t.accountSize.toLowerCase().includes(q),
      );
    }
    const mode = this.rankMode();
    const col = this.sortCol();
    const dir = this.sortDir();
    const metric = (t: LeaderboardTrader) => (mode === 'rewards' ? t.rewards || 0 : t.profit);
    const value = (t: LeaderboardTrader): number | string => {
      switch (col) {
        case 'rank':
        case 'metric':
          return metric(t);
        case 'name':
          return t.name.toLowerCase();
        case 'country':
          return t.country;
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
    return [...list].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      let cmp = 0;
      if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv);
      else cmp = Number(av) - Number(bv);
      if (col === 'rank') {
        cmp = Number(bv) - Number(av);
        return dir === 'asc' ? cmp : -cmp;
      }
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );

  readonly pageNumbers = computed(() => visiblePageNumbers(this.page(), this.pageCount(), 3));

  readonly podium = computed(() => this.filtered().slice(0, 3));

  readonly pageRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filtered()
      .slice(start, start + this.pageSize())
      .map((t, i) => ({ ...t, rank: start + i + 1 }));
  });

  readonly setPage = (p: number) => this.page.set(p);

  setSize(opt: AccountSize) {
    this.accountSize.set(opt);
    this.page.set(1);
  }

  onSortColumn(col: SortCol) {
    if (this.sortCol() === col) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortCol.set(col);
      this.sortDir.set(DEFAULT_DIR[col]);
    }
    this.page.set(1);
  }

  round(n: number) {
    return Math.round(n);
  }

  winColor(ratio: number) {
    const tone = winRatioTone(ratio);
    return tone === 'good' ? '#10b981' : tone === 'mid' ? '#f59e0b' : '#ef4444';
  }

  ringOffset(ratio: number) {
    return this.ringC * (1 - Math.min(100, Math.max(0, ratio)) / 100);
  }
}

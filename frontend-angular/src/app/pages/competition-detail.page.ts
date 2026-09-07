import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  PageNumberPagerComponent,
  visiblePageNumbers,
} from '../components/page-number-pager.component';
import { VirtualizedListComponent } from '../components/virtualized-list.component';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import {
  findCompetition,
  formatCountdown,
  formatShortDate,
  type Competition,
} from '../data/competitions-data';
import {
  COMPETITION_RULES,
  formatStandingMoney,
  getCompetitionStandings,
  type CompetitionStanding,
} from '../data/competition-standings';

type RegisteredParticipant = {
  rank: number;
  traderId: string;
  name: string;
  login?: string | null;
  platform?: string | null;
  accountSize?: number;
  joinedAt: string;
};

type BoardRow = CompetitionStanding & {
  joinedAt?: string;
  login?: string | null;
  accountSize?: number;
  isRegisteredOnly?: boolean;
};

type SortKey =
  | 'rankAsc'
  | 'profitDesc'
  | 'profitAsc'
  | 'tradesDesc'
  | 'winRatioDesc'
  | 'nameAsc'
  | 'joinedAsc';

@Component({
  selector: 'app-competition-detail-page',
  standalone: true,
  imports: [FormsModule, RouterLink, PageNumberPagerComponent, VirtualizedListComponent],
  template: `
    @if (!comp()) {
      <div class="comp-page">
        <p class="err">Competition not found.</p>
        <a routerLink="/competitions" class="rw-btn">Back to Competitions</a>
      </div>
    } @else {
      <div class="cd-page">
        <p class="cd-back"><a routerLink="/competitions">← Competitions</a></p>

        <div class="cd-hero card-surface">
          <div class="cd-hero-main">
            <h1>{{ comp()!.title }}</h1>
            <div class="cd-hero-meta">
              <div class="cd-meta-item">{{ comp()!.platform }}</div>
              <div class="cd-status">
                <span [class]="'cd-status-dot ' + comp()!.status"></span>
                <p>{{ statusLabel(comp()!.status) }}</p>
              </div>
            </div>
            <p class="cd-status-msg">{{ statusMessage(comp()!) }}</p>
            @if (comp()!.status !== 'ended') {
              <p class="cd-countdown meta">
                {{ comp()!.status === 'upcoming' ? 'Starts in' : 'Ending in' }}
                <strong>{{
                  formatCountdown(
                    comp()!.status === 'upcoming' ? comp()!.startsAt : comp()!.endsAt,
                    now()
                  )
                }}</strong>
              </p>
            }
            <div class="cd-hero-actions">
              <button
                type="button"
                class="comp-btn-primary"
                [disabled]="comp()!.status === 'ended' || joined() || busy()"
                (click)="onJoin()"
              >
                {{
                  comp()!.status === 'ended'
                    ? 'Join'
                    : joined()
                      ? 'Joined'
                      : busy()
                        ? 'Joining…'
                        : 'Join'
                }}
              </button>
              <button type="button" class="comp-btn-ghost" (click)="openModal('prize')">
                Show Prizepool
              </button>
              <button type="button" class="comp-btn-ghost" (click)="openModal('about')">
                More Info
              </button>
            </div>
            @if (msg() || err()) {
              <p [class]="err() ? 'err' : 'comp-join-toast'" role="status">{{ err() || msg() }}</p>
            }
          </div>
          <div class="cd-hero-podium">
            @if (comp()!.status === 'upcoming') {
              <div class="cd-reg-hero" aria-label="Registration open">
                <p class="cd-reg-kicker">Pre-start roster</p>
                <strong>{{ registeredCount().toLocaleString() }}</strong>
                <span>traders joined</span>
                <p class="cd-reg-note">Leaderboard metrics unlock when the competition starts.</p>
              </div>
            } @else {
              <div class="cd-podium" aria-label="Top three">
                @for (row of podium(); track row.rank; let i = $index) {
                  <div [class]="i === 0 ? 'cd-podium-slot center' : 'cd-podium-slot side'">
                    <span class="cd-podium-name">{{ row.name }}</span>
                    <span class="cd-podium-place">{{ row.rank }}</span>
                    <span class="cd-flag">{{ row.country }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <div class="cd-grid">
          <div class="cd-board card-surface">
            <div class="cd-toolbar">
              <label class="cd-search">
                <input
                  type="search"
                  [ngModel]="query()"
                  (ngModelChange)="query.set($event); page.set(1)"
                  [placeholder]="
                    comp()!.status === 'upcoming'
                      ? 'Filter by name or login…'
                      : 'Filter by name, country, rank…'
                  "
                />
              </label>
              <label class="cd-filter">
                Sort
                <select [ngModel]="sortKey()" (ngModelChange)="sortKey.set($event); page.set(1)">
                  @if (comp()!.status === 'upcoming') {
                    <option value="rankAsc">Join order</option>
                    <option value="joinedAsc">Joined earliest</option>
                    <option value="nameAsc">Name A–Z</option>
                  } @else {
                    <option value="rankAsc">Rank</option>
                    <option value="profitDesc">Profit high → low</option>
                    <option value="profitAsc">Profit low → high</option>
                    <option value="tradesDesc">Most trades</option>
                    <option value="winRatioDesc">Win ratio</option>
                    <option value="nameAsc">Name A–Z</option>
                  }
                </select>
              </label>
              <label class="cd-filter">
                Page size
                <select
                  [ngModel]="pageSize()"
                  (ngModelChange)="pageSize.set(+$event); page.set(1)"
                >
                  <option [ngValue]="5">5</option>
                  <option [ngValue]="10">10</option>
                  <option [ngValue]="20">20</option>
                  <option [ngValue]="40">40</option>
                </select>
              </label>
              <p class="cd-toolbar-meta">
                {{ filtered().length }} traders · page {{ page() }}/{{ pageCount()
                }}{{ comp()!.status === 'upcoming' ? ' · registered' : '' }}
              </p>
            </div>

            <div class="cd-table-wrap">
              <div
                class="cd-virt-head"
                [class.upcoming]="comp()!.status === 'upcoming'"
                [class.live]="comp()!.status !== 'upcoming'"
              >
                <span>{{ comp()!.status === 'upcoming' ? '#' : 'Rank' }}</span>
                <span>Name</span>
                @if (comp()!.status === 'upcoming') {
                  <span>Login</span>
                  <span>Platform</span>
                  <span>Account</span>
                  <span>Joined</span>
                } @else {
                  <span>Country</span>
                  <span>Trades</span>
                  <span>Win Ratio</span>
                  <span>Profit</span>
                  <span>Gain</span>
                }
              </div>

              @if (pageItems().length === 0) {
                <p class="cd-empty">
                  {{
                    comp()!.status === 'upcoming'
                      ? 'No traders have joined yet. Be the first.'
                      : 'No traders match this filter.'
                  }}
                </p>
              } @else {
                <app-virtualized-list
                  [items]="pageItems()"
                  [estimateSize]="48"
                  [height]="420"
                  [getKey]="rowKey"
                >
                  <ng-template let-row>
                    <div
                      class="cd-virt-row"
                      [class.upcoming]="comp()!.status === 'upcoming'"
                      [class.live]="comp()!.status !== 'upcoming'"
                    >
                      <span>{{ row.rank }}</span>
                      <span>{{ row.name }}</span>
                      @if (comp()!.status === 'upcoming') {
                        <span class="tabular">{{ row.login || '—' }}</span>
                        <span>matchtrader</span>
                        <span class="tabular">
                          {{ '$' + (((row.accountSize || 100000) / 1000).toFixed(0)) + 'k' }}
                        </span>
                        <span>{{ row.joinedAt ? formatShortDate(row.joinedAt) : '—' }}</span>
                      } @else {
                        <span><span class="cd-flag">{{ row.country }}</span></span>
                        <span>{{ row.trades }}</span>
                        <span>{{ row.winRatio }}%</span>
                        <span class="pos">{{ formatStandingMoney(row.profit) }}</span>
                        <span class="pos">{{ row.gainPct.toFixed(2) }}%</span>
                      }
                    </div>
                  </ng-template>
                </app-virtualized-list>
              }
            </div>

            <app-page-number-pager
              [page]="page()"
              [pageCount]="pageCount()"
              [pageNumbers]="pageNumbers()"
              [onPageChange]="setPage"
            />
          </div>

          <aside class="cd-sidebar">
            <div class="cd-rank-card">
              <div class="cd-rank-card-title">
                {{
                  comp()!.status === 'upcoming'
                    ? joined()
                      ? "You're registered"
                      : 'Registration'
                    : 'Current Rank'
                }}
              </div>
              <p class="cd-rank-card-sub">
                {{
                  comp()!.status === 'upcoming'
                    ? joined()
                      ? "You're on the joined-traders list. Rankings start when the competition goes live."
                      : 'Join to appear on the registered traders table before start.'
                    : 'Your current rank in the competition.'
                }}
              </p>
            </div>

            <div class="cd-side-panel card-surface">
              <div class="cd-side-facts">
                <div class="cd-fact">
                  <div>
                    <p>Starts</p>
                    <strong>{{ formatShortDate(comp()!.startsAt) }}</strong>
                  </div>
                </div>
                <div class="cd-fact">
                  <div>
                    <p>Ends</p>
                    <strong>{{ formatShortDate(comp()!.endsAt) }}</strong>
                  </div>
                </div>
                <div class="cd-fact">
                  <div>
                    <p>Entry</p>
                    <strong>{{ comp()!.entry }}</strong>
                  </div>
                </div>
                <div class="cd-fact">
                  <div>
                    <p>Participants</p>
                    <strong>
                      {{
                        comp()!.status === 'upcoming'
                          ? registeredCount().toLocaleString() + ' joined'
                          : comp()!.participants.toLocaleString()
                      }}
                    </strong>
                  </div>
                </div>
                <div class="cd-fact">
                  <div>
                    <p>Organizer</p>
                    <strong>{{ comp()!.host }}</strong>
                  </div>
                </div>
              </div>
              <h3 class="cd-rules-title">Trading Rules</h3>
              <ul class="cd-rules">
                @for (rule of rules; track rule) {
                  <li>{{ rule }}</li>
                }
              </ul>
            </div>
          </aside>
        </div>

        @if (modalHtml()) {
          <div class="comp-modal-backdrop" role="presentation" (click)="closeModal()">
            <div class="comp-modal" role="dialog" (click)="$event.stopPropagation()">
              <header class="comp-modal-header"><h2>{{ modalTitle() }}</h2></header>
              <div class="comp-modal-body prose-comp" [innerHTML]="modalHtml()"></div>
              <button type="button" class="comp-modal-close" (click)="closeModal()">×</button>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class CompetitionDetailPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private timer?: ReturnType<typeof setInterval>;

  readonly formatCountdown = formatCountdown;
  readonly formatShortDate = formatShortDate;
  readonly formatStandingMoney = formatStandingMoney;
  readonly rules = COMPETITION_RULES;

  readonly comp = signal<Competition | undefined>(undefined);
  readonly now = signal(Date.now());
  readonly joined = signal(false);
  readonly busy = signal(false);
  readonly msg = signal('');
  readonly err = signal('');
  readonly registered = signal<RegisteredParticipant[]>([]);
  readonly registeredCount = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(5);
  readonly modalTitle = signal('');
  readonly modalHtml = signal<SafeHtml | null>(null);
  readonly query = signal('');
  readonly sortKey = signal<SortKey>('rankAsc');

  readonly rowKey = (item: unknown, index: number) => {
    const row = item as BoardRow;
    return `${row.rank}-${row.name}-${row.login || index}`;
  };

  readonly boardRows = computed((): BoardRow[] => {
    const c = this.comp();
    if (!c) return [];
    if (c.status === 'upcoming') {
      return this.registered().map((p) => ({
        rank: p.rank,
        name: p.name,
        country: '—',
        trades: 0,
        winRatio: 0,
        profit: 0,
        gainPct: 0,
        joinedAt: p.joinedAt,
        login: p.login,
        accountSize: p.accountSize || 100_000,
        isRegisteredOnly: true,
      }));
    }
    return getCompetitionStandings(c.id);
  });

  readonly podium = computed(() => this.boardRows().slice(0, 3));

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    let list = this.boardRows();
    if (q) {
      list = list.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          row.country.toLowerCase().includes(q) ||
          String(row.rank).includes(q) ||
          (row.login || '').toLowerCase().includes(q),
      );
    }
    const key = this.sortKey();
    return [...list].sort((a, b) => {
      switch (key) {
        case 'profitDesc':
          return b.profit - a.profit;
        case 'profitAsc':
          return a.profit - b.profit;
        case 'tradesDesc':
          return b.trades - a.trades;
        case 'winRatioDesc':
          return b.winRatio - a.winRatio;
        case 'nameAsc':
          return a.name.localeCompare(b.name);
        case 'joinedAsc':
          return String(a.joinedAt || '').localeCompare(String(b.joinedAt || ''));
        case 'rankAsc':
        default:
          return a.rank - b.rank;
      }
    });
  });

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );
  readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });
  readonly pageNumbers = computed(() => visiblePageNumbers(this.page(), this.pageCount(), 3));
  readonly setPage = (p: number) => this.page.set(p);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.comp.set(findCompetition(id));
    this.timer = setInterval(() => this.now.set(Date.now()), 1000);
    if (!id) return;
    void this.api
      .request<{ competitionIds: string[] }>('/api/competitions/joined')
      .then((res) => this.joined.set((res.competitionIds || []).includes(id)))
      .catch(() => undefined);
    this.loadParticipants(id);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  statusLabel(status: string) {
    return status === 'ongoing' ? 'Ongoing' : status === 'ended' ? 'Ended' : 'Upcoming';
  }

  statusMessage(c: Competition) {
    if (c.status === 'ended') return 'This competition has ended';
    if (c.status === 'upcoming') return 'Registration is open — join before it starts';
    return 'Competition is live';
  }

  loadParticipants(id: string) {
    void this.api
      .request<{ count: number; participants: RegisteredParticipant[] }>(
        `/api/competitions/${encodeURIComponent(id)}/participants`,
      )
      .then((res) => {
        this.registered.set(Array.isArray(res.participants) ? res.participants : []);
        this.registeredCount.set(Number(res.count || res.participants?.length || 0));
      })
      .catch(() => {
        this.registered.set([]);
        this.registeredCount.set(0);
      });
  }

  openModal(kind: 'prize' | 'about') {
    const c = this.comp();
    if (!c) return;
    this.modalTitle.set(kind === 'prize' ? 'Prize pool for this competition' : 'About this Competition');
    this.modalHtml.set(
      this.sanitizer.bypassSecurityTrustHtml(kind === 'prize' ? c.prizeHtml : c.aboutHtml),
    );
  }

  closeModal() {
    this.modalHtml.set(null);
  }

  async onJoin() {
    const c = this.comp();
    if (!c || c.status === 'ended') return;
    this.err.set('');
    this.msg.set('');
    if (!this.auth.user()) {
      await this.router.navigateByUrl(
        '/login?next=' + encodeURIComponent(`/competitions/${c.id}`),
      );
      return;
    }
    this.busy.set(true);
    try {
      const res = await this.api.request<{ alreadyJoined: boolean; emailSent: boolean }>(
        `/api/competitions/${c.id}/join`,
        { method: 'POST', body: JSON.stringify({ title: c.title }) },
      );
      this.joined.set(true);
      this.loadParticipants(c.id);
      if (res.alreadyJoined) this.msg.set('You already joined this competition.');
      else if (res.emailSent) this.msg.set('Joined — confirmation email sent (check Mailpit).');
      else this.msg.set('Joined, but email delivery failed.');
    } catch (ex: unknown) {
      this.err.set(ex instanceof Error ? ex.message : 'Join failed');
    } finally {
      this.busy.set(false);
    }
  }
}

import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import {
  PageNumberPagerComponent,
  visiblePageNumbers,
} from '../components/page-number-pager.component';
import {
  CHAMPIONSHIPS,
  COMPETITIONS,
  formatCountdown,
  formatShortDate,
  type Competition,
  type CompetitionStatus,
} from '../data/competitions-data';

type Tab = 'joined' | 'propfirm' | 'championships' | 'hosted';
type SortKey = 'startsDesc' | 'startsAsc' | 'titleAsc' | 'participantsDesc' | 'status';

const STATUS_RANK: Record<CompetitionStatus, number> = {
  upcoming: 0,
  ongoing: 1,
  ended: 2,
};

@Component({
  selector: 'app-competitions-page',
  standalone: true,
  imports: [FormsModule, RouterLink, PageNumberPagerComponent],
  template: `
    <div class="comp-page">
      <div class="comp-heading">
        <div class="comp-avatar">{{ initial() }}</div>
        <h1>Hey, {{ name() }}</h1>
      </div>

      <div class="comp-body">
        @if (tab() === 'propfirm' && featured(); as f) {
          <div class="comp-featured-wrap">
            <section class="comp-featured">
              <div class="comp-featured-overlay"></div>
              <div class="comp-featured-body">
                <header><h4>{{ f.kind }}</h4></header>
                <div class="comp-featured-main">
                  <h2>{{ f.title }}</h2>
                  <div class="comp-featured-meta">
                    <div class="comp-status">
                      <span [class]="'comp-status-dot ' + f.status"></span>
                      <p>{{ statusLabel(f.status) }}</p>
                    </div>
                    <div class="comp-meta-item">
                      <svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63Zm-96,96L48,132.69V48h84.69L232,147.31ZM96,84A12,12,0,1,1,84,72,12,12,0,0,1,96,84Z" />
                      </svg>
                      {{ f.platform }}
                    </div>
                    <div class="comp-meta-item">
                      <svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z" />
                      </svg>
                      {{ f.participants.toLocaleString() }}
                    </div>
                  </div>
                </div>
                <div class="comp-featured-dates">
                  <div>
                    <p>Starts</p>
                    <strong>{{ formatShortDate(f.startsAt) }}</strong>
                  </div>
                  <div>
                    <p>Ends</p>
                    <strong>{{ formatShortDate(f.endsAt) }}</strong>
                  </div>
                  <div>
                    <p>{{ f.status === 'upcoming' ? 'Starts in' : 'Ending in' }}</p>
                    <strong>{{
                      f.status === 'ended'
                        ? '00:00:00'
                        : formatCountdown(f.status === 'upcoming' ? f.startsAt : f.endsAt, now())
                    }}</strong>
                  </div>
                </div>
                <div class="comp-featured-actions">
                  @if (f.status === 'upcoming') {
                    <button
                      type="button"
                      class="comp-btn-primary"
                      [disabled]="joinedIds().has(f.id) || joiningId() === f.id"
                      (click)="joinCompetition(f)"
                    >
                      {{ joinedIds().has(f.id) ? 'Joined' : joiningId() === f.id ? 'Joining…' : 'Join' }}
                    </button>
                  } @else {
                    <a [routerLink]="['/competitions', f.id]" class="comp-btn-primary">View</a>
                  }
                  <a [routerLink]="['/competitions', f.id]" class="comp-btn-ghost">Details</a>
                  <button type="button" class="comp-btn-ghost" (click)="openModal('prize', f)">
                    Show Prizepool
                  </button>
                  <button type="button" class="comp-btn-ghost" (click)="openModal('about', f)">
                    More Info
                  </button>
                </div>
              </div>
              <div class="comp-featured-art">
                <img src="/trophy-pink.webp" alt="" class="comp-trophy" width="256" height="256" />
              </div>
            </section>
          </div>
        }

        @if (joinMsg() || joinErr()) {
          <p [class]="joinErr() ? 'err' : 'comp-join-toast'" role="status">
            {{ joinErr() || joinMsg() }}
          </p>
        }

        <div class="comp-tabs-row">
          <div class="comp-tabs">
            @for (t of tabs; track t.id) {
              <button type="button" [class.on]="tab() === t.id" (click)="setTab(t.id)">
                {{ t.label }}
              </button>
            }
          </div>
        </div>

        <div class="comp-toolbar">
          <label class="comp-search">
            <span class="sr-only">Search competitions</span>
            <input
              type="search"
              placeholder="Filter by title, platform…"
              [ngModel]="query()"
              (ngModelChange)="query.set($event); page.set(1)"
            />
          </label>
          <label class="comp-filter">
            Status
            <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); page.set(1)">
              <option value="all">All</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="ended">Ended</option>
            </select>
          </label>
          <label class="comp-filter">
            Sort
            <select [ngModel]="sortKey()" (ngModelChange)="sortKey.set($event); page.set(1)">
              <option value="startsDesc">Newest start</option>
              <option value="startsAsc">Oldest start</option>
              <option value="titleAsc">Title A–Z</option>
              <option value="participantsDesc">Most participants</option>
              <option value="status">Status</option>
            </select>
          </label>
          <label class="comp-filter">
            Page size
            <select
              [ngModel]="pageSize()"
              (ngModelChange)="pageSize.set(+$event); page.set(1)"
            >
              <option [ngValue]="8">8</option>
              <option [ngValue]="12">12</option>
              <option [ngValue]="24">24</option>
              <option [ngValue]="48">48</option>
            </select>
          </label>
          <p class="comp-toolbar-meta">
            {{ filtered().length }} matches · page {{ page() }}/{{ pageCount() }}
          </p>
        </div>

        <section class="comp-list">
          @if (pageItems().length === 0) {
            <div class="comp-list-empty">
              <p>
                {{
                  tab() === 'joined'
                    ? 'No joined competitions yet. Join an upcoming event to see it here.'
                    : tab() === 'hosted'
                      ? 'You have not hosted any competitions yet.'
                      : 'No competitions match this filter.'
                }}
              </p>
            </div>
          } @else {
            <div class="comp-grid">
              @for (c of pageItems(); track c.id) {
                <article class="comp-card">
                  <div class="comp-card-timer">
                    <time>
                      {{
                        c.status === 'ended'
                          ? '00:00:00'
                          : formatCountdown(c.status === 'upcoming' ? c.startsAt : c.endsAt, now())
                      }}
                    </time>
                  </div>
                  <h2>{{ c.title }}</h2>
                  <div class="comp-card-meta">
                    <div class="comp-status">
                      <span [class]="'comp-status-dot ' + c.status"></span>
                      <p>{{ statusLabel(c.status) }}</p>
                    </div>
                    <div class="comp-meta-item">
                      <svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68a16,16,0,0,0,0-22.63Zm-96,96L48,132.69V48h84.69L232,147.31ZM96,84A12,12,0,1,1,84,72,12,12,0,0,1,96,84Z" />
                      </svg>
                      <span>{{ c.entry }}</span>
                    </div>
                    <div class="comp-meta-item muted">
                      <svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z" />
                      </svg>
                      <span>{{ c.participants.toLocaleString() }}</span>
                    </div>
                  </div>
                  <footer>
                    <div class="comp-chips">
                      <span>{{ c.host }}</span>
                      <span>{{ c.platform }}</span>
                    </div>
                    <div class="comp-card-actions">
                      @if (c.status === 'upcoming') {
                        <button
                          type="button"
                          class="comp-btn-primary compact"
                          [disabled]="joinedIds().has(c.id) || joiningId() === c.id"
                          (click)="joinCompetition(c)"
                        >
                          {{ joinedIds().has(c.id) ? 'Joined' : joiningId() === c.id ? '…' : 'Join' }}
                        </button>
                      }
                      <a [routerLink]="['/competitions', c.id]" class="comp-btn-primary compact">View</a>
                    </div>
                  </footer>
                </article>
              }
            </div>
          }
        </section>

        <app-page-number-pager
          [page]="page()"
          [pageCount]="pageCount()"
          [pageNumbers]="pageNumbers()"
          [onPageChange]="setPage"
        />
      </div>

      @if (modalHtml()) {
        <div class="comp-modal-backdrop" role="presentation" (click)="closeModal()">
          <div class="comp-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
            <header class="comp-modal-header">
              <h2>{{ modalTitle() }}</h2>
            </header>
            <div class="comp-modal-body prose-comp" [innerHTML]="modalHtml()"></div>
            <button type="button" class="comp-modal-close" (click)="closeModal()" aria-label="Close">×</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class CompetitionsPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private timer?: ReturnType<typeof setInterval>;

  readonly tabs = [
    { id: 'joined' as Tab, label: 'Joined' },
    { id: 'propfirm' as Tab, label: 'PropFirm' },
    { id: 'championships' as Tab, label: 'Championships' },
    { id: 'hosted' as Tab, label: 'Hosted' },
  ];

  readonly formatCountdown = formatCountdown;
  readonly formatShortDate = formatShortDate;

  readonly name = signal('Trader');
  readonly now = signal(Date.now());
  readonly tab = signal<Tab>('propfirm');
  readonly joinedIds = signal(new Set<string>());
  readonly joiningId = signal<string | null>(null);
  readonly joinMsg = signal('');
  readonly joinErr = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(12);
  readonly modalTitle = signal('');
  readonly modalHtml = signal<SafeHtml | null>(null);

  readonly query = signal('');
  readonly statusFilter = signal<'all' | CompetitionStatus>('all');
  readonly sortKey = signal<SortKey>('startsDesc');

  readonly initial = computed(() => (this.name() || 'T').charAt(0).toUpperCase());
  readonly featured = computed(
    () =>
      COMPETITIONS.find((c) => c.featured) ||
      COMPETITIONS.find((c) => c.status === 'upcoming') ||
      COMPETITIONS[0],
  );

  readonly tabList = computed(() => {
    const t = this.tab();
    if (t === 'hosted') return [] as Competition[];
    if (t === 'championships') return CHAMPIONSHIPS;
    if (t === 'joined') {
      return [...COMPETITIONS, ...CHAMPIONSHIPS].filter((c) => this.joinedIds().has(c.id));
    }
    return COMPETITIONS;
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    let list = this.tabList();
    const statusFilter = this.statusFilter();
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter);
    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.platform.toLowerCase().includes(q) ||
          c.host.toLowerCase().includes(q) ||
          c.status.includes(q),
      );
    }
    const key = this.sortKey();
    return [...list].sort((a, b) => {
      switch (key) {
        case 'startsAsc':
          return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
        case 'titleAsc':
          return a.title.localeCompare(b.title);
        case 'participantsDesc':
          return b.participants - a.participants;
        case 'status':
          return (
            STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
            new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
          );
        case 'startsDesc':
        default:
          return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
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
    const session = this.auth.user();
    void this.api
      .request<{ displayName?: string }>('/api/users/me')
      .then((me) => {
        const n = me?.displayName || session?.displayName || 'Trader';
        this.name.set(n.split(/\s+/)[0] || n);
      })
      .catch(() => {
        const n = session?.displayName || 'Trader';
        this.name.set(n.split(/\s+/)[0] || n);
      });
    void this.api
      .request<{ competitionIds: string[] }>('/api/competitions/joined')
      .then((res) => this.joinedIds.set(new Set(res.competitionIds || [])))
      .catch(() => this.joinedIds.set(new Set()));
    this.timer = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  setTab(id: Tab) {
    this.tab.set(id);
    this.page.set(1);
  }

  statusLabel(status: CompetitionStatus) {
    return status === 'ongoing' ? 'Ongoing' : status === 'ended' ? 'Ended' : 'Upcoming';
  }

  openModal(kind: 'prize' | 'about', c: Competition) {
    this.modalTitle.set(kind === 'prize' ? 'Prize pool for this competition' : 'About this Competition');
    this.modalHtml.set(
      this.sanitizer.bypassSecurityTrustHtml(kind === 'prize' ? c.prizeHtml : c.aboutHtml),
    );
  }

  closeModal() {
    this.modalHtml.set(null);
  }

  async joinCompetition(c: Competition) {
    this.joinErr.set('');
    this.joinMsg.set('');
    if (!this.auth.user()) {
      await this.router.navigateByUrl('/login?next=' + encodeURIComponent('/competitions'));
      return;
    }
    this.joiningId.set(c.id);
    try {
      const res = await this.api.request<{ joined: boolean; alreadyJoined: boolean; emailSent: boolean }>(
        `/api/competitions/${c.id}/join`,
        { method: 'POST', body: JSON.stringify({ title: c.title }) },
      );
      this.joinedIds.update((prev) => new Set(prev).add(c.id));
      if (res.alreadyJoined) this.joinMsg.set(`Already joined “${c.title}”.`);
      else if (res.emailSent) this.joinMsg.set(`Joined “${c.title}”. Confirmation email sent — check Mailpit.`);
      else this.joinMsg.set(`Joined “${c.title}”. Email could not be delivered.`);
    } catch (ex: unknown) {
      this.joinErr.set(ex instanceof Error ? ex.message : 'Join failed');
    } finally {
      this.joiningId.set(null);
    }
  }
}

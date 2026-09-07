import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import {
  CALENDAR_CURRENCIES,
  CALENDAR_EVENTS,
  dayKey,
  formatDayLabel,
  formatEventTime,
  startOfLocalDay,
  type CalendarEvent,
  type ImpactLevel,
} from '../lib/economic-calendar-data';

type ImpactFilter = ImpactLevel | 'past';

type CalendarApiResponse = {
  source: string;
  provider?: string;
  from?: string;
  to?: string;
  detail?: string | null;
  items: CalendarEvent[];
};

function normalizeImpact(raw: string | undefined): ImpactLevel {
  const v = (raw || '').toLowerCase();
  if (v === 'high') return 'high';
  if (v === 'medium' || v === 'med') return 'medium';
  if (v === 'low') return 'low';
  return 'none';
}

function impactColor(level: ImpactLevel) {
  if (level === 'high') return 'high';
  if (level === 'medium') return 'med';
  if (level === 'low') return 'low';
  return 'none';
}

function impactLabel(level: ImpactLevel) {
  if (level === 'high') return 'High';
  if (level === 'medium') return 'Medium';
  if (level === 'low') return 'Low';
  return 'No Impact';
}

@Component({
  selector: 'app-economic-calendar-page',
  standalone: true,
  template: `
    <div class="ec-page">
      <header class="ec-heading">
        <div class="ec-brand-lockup" aria-hidden>
          <span class="ec-brand-mark">PF</span>
          <span class="ec-brand-name">PropFirm</span>
        </div>
        <div class="ec-heading-rule"></div>
        <h1>Economic Calendar</h1>
        <p class="ec-source meta" role="status">
          {{
            source() === 'loading'
              ? 'Loading calendar…'
              : source() === 'live'
                ? 'Live · ' + statusDetail()
                : source() === 'demo'
                  ? 'Demo · ' + statusDetail()
                  : 'Fallback · ' + statusDetail()
          }}
        </p>
      </header>

      <div class="ec-panel">
        <div class="ec-toolbar">
          <div class="ec-filters-block">
            <span class="ec-filters-label">Filters</span>
            <div class="ec-currency-wrap">
              <button type="button" class="ec-currency-btn" [attr.aria-expanded]="currencyOpen()" (click)="currencyOpen.set(!currencyOpen())">
                {{ currencyLabel() }}
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 256 256" aria-hidden [style.transform]="currencyOpen() ? 'rotate(180deg)' : null">
                  <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                </svg>
              </button>
              @if (currencyOpen()) {
                <div class="ec-currency-menu" role="listbox" aria-label="Currencies">
                  <button type="button" class="ec-currency-clear" (click)="currencies.set([])">Clear all</button>
                  @for (code of calendarCurrencies; track code) {
                    <label class="ec-currency-item">
                      <input type="checkbox" [checked]="currencies().includes(code)" (change)="toggleCurrency(code)" />
                      {{ code }}
                    </label>
                  }
                </div>
              }
            </div>
          </div>

          <div class="ec-impact-row" role="group" aria-label="Impact filters">
            @for (p of impactPills; track p.key) {
              <button type="button" class="ec-pill" [class.on]="hasImpact(p.key)" [attr.aria-pressed]="hasImpact(p.key)" (click)="toggleImpact(p.key)">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden class="ec-pill-dot" [class]="p.tone">
                  <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
                </svg>
                {{ p.label }}
              </button>
            }
          </div>

          <div class="ec-days" role="group" aria-label="Day selector">
            <div class="ec-days-scroll">
              @for (d of selectedDayOptions(); track d.offset) {
                <button type="button" class="ec-day on" [attr.aria-pressed]="true" (click)="toggleDay(d.offset)">
                  {{ d.label }}
                  <span>{{ d.count }}</span>
                </button>
              }
            </div>
            <div class="ec-add-day-wrap">
              <button type="button" class="ec-add-day" [attr.aria-expanded]="addDayOpen()" (click)="addDayOpen.set(!addDayOpen())">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
                  <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
                </svg>
                Add day
              </button>
              @if (addDayOpen()) {
                <div class="ec-add-day-menu">
                  @if (availableToAdd().length === 0) {
                    <p>All days in range selected</p>
                  } @else {
                    @for (d of availableToAdd(); track d.offset) {
                      <button type="button" (click)="addDay(d.offset)">{{ d.label }} <span>{{ d.count }}</span></button>
                    }
                  }
                </div>
              }
            </div>
          </div>
        </div>

        @if (source() === 'loading') {
          <div class="ec-empty"><p>Loading economic calendar…</p></div>
        } @else if (grouped().length === 0) {
          <div class="ec-empty">
            <p>No economic calendar data available</p>
            <p>Try adjusting your filters to see more results</p>
          </div>
        } @else {
          @for (g of grouped(); track g[0]) {
            <section class="ec-day-section">
              <h2>{{ formatDayLabel(g[1][0].datetime) }}</h2>
              <div class="ec-table-wrap">
                <table class="ec-table">
                  <thead>
                    <tr>
                      <th>Time</th><th>Ccy</th><th>Event</th><th>Impact</th>
                      <th class="end">Actual</th><th class="end">Forecast</th><th class="end">Previous</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (e of g[1]; track e.id) {
                      <tr>
                        <td class="ec-time">{{ formatEventTime(e.datetime) }}</td>
                        <td><span class="ec-ccy">{{ e.currency }}</span></td>
                        <td class="ec-title">{{ e.title }}</td>
                        <td><span class="ec-impact" [class]="impactColor(e.impact)">{{ impactLabel(e.impact) }}</span></td>
                        <td class="end">{{ e.actual ?? '—' }}</td>
                        <td class="end">{{ e.forecast ?? '—' }}</td>
                        <td class="end">{{ e.previous ?? '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <ul class="ec-cards">
                @for (e of g[1]; track e.id) {
                  <li class="ec-card">
                    <div class="ec-card-top">
                      <span class="ec-time">{{ formatEventTime(e.datetime) }}</span>
                      <span class="ec-ccy">{{ e.currency }}</span>
                      <span class="ec-impact" [class]="impactColor(e.impact)">{{ impactLabel(e.impact) }}</span>
                    </div>
                    <p class="ec-card-title">{{ e.title }}</p>
                    <dl class="ec-card-stats">
                      <div><dt>Actual</dt><dd>{{ e.actual ?? '—' }}</dd></div>
                      <div><dt>Forecast</dt><dd>{{ e.forecast ?? '—' }}</dd></div>
                      <div><dt>Previous</dt><dd>{{ e.previous ?? '—' }}</dd></div>
                    </dl>
                  </li>
                }
              </ul>
            </section>
          }
        }
      </div>
    </div>
  `,
})
export class EconomicCalendarPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly calendarCurrencies = CALENDAR_CURRENCIES;
  readonly formatDayLabel = formatDayLabel;
  readonly formatEventTime = formatEventTime;
  readonly impactColor = impactColor;
  readonly impactLabel = impactLabel;

  readonly impactPills = [
    { key: 'high' as ImpactFilter, label: 'High', tone: 'high' },
    { key: 'medium' as ImpactFilter, label: 'Medium', tone: 'med' },
    { key: 'low' as ImpactFilter, label: 'Low', tone: 'low' },
    { key: 'none' as ImpactFilter, label: 'No Impact', tone: 'none' },
    { key: 'past' as ImpactFilter, label: 'Past Events', tone: 'none' },
  ];

  readonly currencies = signal<string[]>([]);
  readonly currencyOpen = signal(false);
  readonly impacts = signal<Set<ImpactFilter>>(new Set());
  readonly selectedDays = signal<number[]>([0]);
  readonly addDayOpen = signal(false);
  readonly events = signal<CalendarEvent[]>(CALENDAR_EVENTS);
  readonly source = signal<'loading' | 'live' | 'demo' | 'error'>('loading');
  readonly statusDetail = signal('');

  readonly dayOptions = computed(() => {
    const today = startOfLocalDay();
    const events = this.events();
    return [-2, -1, 0, 1, 2, 3, 4].map((offset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const count = events.filter((e) => dayKey(e.datetime) === dayKey(d.toISOString())).length;
      return { offset, date: d, label: formatDayLabel(d), count };
    });
  });

  readonly selectedDayOptions = computed(() =>
    this.dayOptions().filter((d) => this.selectedDays().includes(d.offset)),
  );
  readonly availableToAdd = computed(() =>
    this.dayOptions().filter((d) => !this.selectedDays().includes(d.offset)),
  );

  readonly currencyLabel = computed(() => {
    const c = this.currencies();
    if (c.length === 0) return 'Select currency';
    if (c.length <= 2) return c.join(', ');
    return `${c.length} currencies`;
  });

  readonly filtered = computed(() => {
    const today = startOfLocalDay().getTime();
    const impacts = this.impacts();
    const showPastOnly = impacts.has('past') && impacts.size === 1;
    const impactKeys = [...impacts].filter((k): k is ImpactLevel => k !== 'past');
    const currencies = this.currencies();
    const selectedDays = this.selectedDays();

    return this.events()
      .filter((e) => {
        const t = new Date(e.datetime).getTime();
        const eDay = startOfLocalDay(new Date(e.datetime)).getTime();
        const offset = Math.round((eDay - today) / 86_400_000);
        if (!selectedDays.includes(offset)) return false;
        if (currencies.length && !currencies.includes(e.currency)) return false;
        if (showPastOnly) return t < Date.now();
        if (impacts.has('past') && t >= Date.now()) return false;
        if (impactKeys.length && !impactKeys.includes(e.impact)) return false;
        return true;
      })
      .sort((a, b) => +new Date(a.datetime) - +new Date(b.datetime));
  });

  readonly grouped = computed(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of this.filtered()) {
      const k = dayKey(e.datetime);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()];
  });

  ngOnInit() {
    const { from, to } = this.rangeIso([-2, -1, 0, 1, 2, 3, 4]);
    void this.api
      .request<CalendarApiResponse>(`/api/economic-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((res) => {
        const items = (res.items || []).map((e) => ({ ...e, impact: normalizeImpact(e.impact) }));
        if (res.source === 'live' && items.length > 0) {
          this.events.set(items);
          this.source.set('live');
          this.statusDetail.set(`Financial Modeling Prep · ${from} → ${to}`);
        } else if (res.source === 'live') {
          this.events.set([]);
          this.source.set('live');
          this.statusDetail.set(res.detail || 'No events in this range');
        } else if (res.source === 'error') {
          this.events.set(CALENDAR_EVENTS);
          this.source.set('error');
          this.statusDetail.set(res.detail || 'Live calendar failed — showing demo events');
        } else {
          this.events.set(CALENDAR_EVENTS);
          this.source.set('demo');
          this.statusDetail.set(res.detail || 'Demo data — set Fmp:ApiKey on the API for live events');
        }
      })
      .catch((ex: unknown) => {
        this.events.set(CALENDAR_EVENTS);
        this.source.set('error');
        this.statusDetail.set(ex instanceof Error ? ex.message : 'Failed to reach calendar API — showing demo');
      });
  }

  hasImpact(key: ImpactFilter) {
    return this.impacts().has(key);
  }

  toggleImpact(key: ImpactFilter) {
    const next = new Set(this.impacts());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.impacts.set(next);
  }

  toggleCurrency(code: string) {
    const prev = this.currencies();
    this.currencies.set(prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  }

  toggleDay(offset: number) {
    const prev = this.selectedDays();
    if (prev.includes(offset)) {
      if (prev.length === 1) return;
      this.selectedDays.set(prev.filter((d) => d !== offset));
    } else {
      this.selectedDays.set([...prev, offset].sort((a, b) => a - b));
    }
  }

  addDay(offset: number) {
    const prev = this.selectedDays();
    this.selectedDays.set(prev.includes(offset) ? prev : [...prev, offset].sort((a, b) => a - b));
    this.addDayOpen.set(false);
  }

  private rangeIso(offsets: number[]) {
    const today = startOfLocalDay();
    const min = Math.min(...offsets, -2);
    const max = Math.max(...offsets, 4);
    const from = new Date(today);
    from.setDate(from.getDate() + min);
    const to = new Date(today);
    to.setDate(to.getDate() + max);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: fmt(from), to: fmt(to) };
  }
}

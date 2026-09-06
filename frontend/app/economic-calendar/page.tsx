'use client';

import { useMemo, useState } from 'react';
import {
  CALENDAR_CURRENCIES,
  CALENDAR_EVENTS,
  dayKey,
  formatDayLabel,
  formatEventTime,
  startOfLocalDay,
  type CalendarEvent,
  type ImpactLevel,
} from '@/lib/economic-calendar-data';

type ImpactFilter = ImpactLevel | 'past';

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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      fill="currentColor"
      viewBox="0 0 256 256"
      aria-hidden
      className={className}
    >
      <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      fill="currentColor"
      viewBox="0 0 256 256"
      aria-hidden
      style={{ transform: open ? 'rotate(180deg)' : undefined }}
    >
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <tr>
      <td className="ec-time">{formatEventTime(event.datetime)}</td>
      <td>
        <span className="ec-ccy">{event.currency}</span>
      </td>
      <td className="ec-title">{event.title}</td>
      <td>
        <span className={`ec-impact ${impactColor(event.impact)}`}>{impactLabel(event.impact)}</span>
      </td>
      <td className="end">{event.actual ?? '—'}</td>
      <td className="end">{event.forecast ?? '—'}</td>
      <td className="end">{event.previous ?? '—'}</td>
    </tr>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <li className="ec-card">
      <div className="ec-card-top">
        <span className="ec-time">{formatEventTime(event.datetime)}</span>
        <span className="ec-ccy">{event.currency}</span>
        <span className={`ec-impact ${impactColor(event.impact)}`}>{impactLabel(event.impact)}</span>
      </div>
      <p className="ec-card-title">{event.title}</p>
      <dl className="ec-card-stats">
        <div>
          <dt>Actual</dt>
          <dd>{event.actual ?? '—'}</dd>
        </div>
        <div>
          <dt>Forecast</dt>
          <dd>{event.forecast ?? '—'}</dd>
        </div>
        <div>
          <dt>Previous</dt>
          <dd>{event.previous ?? '—'}</dd>
        </div>
      </dl>
    </li>
  );
}

export default function EconomicCalendarPage() {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [impacts, setImpacts] = useState<Set<ImpactFilter>>(new Set());
  const [selectedDays, setSelectedDays] = useState<number[]>([0]);
  const [addDayOpen, setAddDayOpen] = useState(false);

  const dayOptions = useMemo(() => {
    const today = startOfLocalDay();
    return [-2, -1, 0, 1, 2, 3, 4].map((offset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const count = CALENDAR_EVENTS.filter((e) => dayKey(e.datetime) === dayKey(d.toISOString())).length;
      return { offset, date: d, label: formatDayLabel(d), count };
    });
  }, []);

  const toggleImpact = (key: ImpactFilter) => {
    setImpacts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCurrency = (code: string) => {
    setCurrencies((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const toggleDay = (offset: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(offset)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== offset);
      }
      return [...prev, offset].sort((a, b) => a - b);
    });
  };

  const addDay = (offset: number) => {
    setSelectedDays((prev) => (prev.includes(offset) ? prev : [...prev, offset].sort((a, b) => a - b)));
    setAddDayOpen(false);
  };

  const filtered = useMemo(() => {
    const today = startOfLocalDay().getTime();
    const showPastOnly = impacts.has('past') && impacts.size === 1;
    const impactKeys = [...impacts].filter((k): k is ImpactLevel => k !== 'past');

    return CALENDAR_EVENTS.filter((e) => {
      const t = new Date(e.datetime).getTime();
      const eDay = startOfLocalDay(new Date(e.datetime)).getTime();
      const offset = Math.round((eDay - today) / 86_400_000);

      if (!selectedDays.includes(offset)) return false;
      if (currencies.length && !currencies.includes(e.currency)) return false;

      if (showPastOnly) return t < Date.now();
      if (impacts.has('past') && t >= Date.now()) return false;
      if (impactKeys.length && !impactKeys.includes(e.impact)) return false;

      return true;
    }).sort((a, b) => +new Date(a.datetime) - +new Date(b.datetime));
  }, [currencies, impacts, selectedDays]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const k = dayKey(e.datetime);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  const currencyLabel =
    currencies.length === 0
      ? 'Select currency'
      : currencies.length <= 2
        ? currencies.join(', ')
        : `${currencies.length} currencies`;

  const availableToAdd = dayOptions.filter((d) => !selectedDays.includes(d.offset));

  return (
    <div className="ec-page">
      <header className="ec-heading">
        <div className="ec-brand-lockup" aria-hidden>
          <span className="ec-brand-mark">PF</span>
          <span className="ec-brand-name">PropFirm</span>
        </div>
        <div className="ec-heading-rule" />
        <h1>Economic Calendar</h1>
      </header>

      <div className="ec-panel">
        <div className="ec-toolbar">
          <div className="ec-filters-block">
            <span className="ec-filters-label">Filters</span>
            <div className="ec-currency-wrap">
              <button
                type="button"
                className="ec-currency-btn"
                aria-expanded={currencyOpen}
                aria-haspopup="listbox"
                onClick={() => setCurrencyOpen((o) => !o)}
              >
                {currencyLabel}
                <ChevronIcon open={currencyOpen} />
              </button>
              {currencyOpen && (
                <div className="ec-currency-menu" role="listbox" aria-label="Currencies">
                  <button type="button" className="ec-currency-clear" onClick={() => setCurrencies([])}>
                    Clear all
                  </button>
                  {CALENDAR_CURRENCIES.map((code) => (
                    <label key={code} className="ec-currency-item">
                      <input
                        type="checkbox"
                        checked={currencies.includes(code)}
                        onChange={() => toggleCurrency(code)}
                      />
                      {code}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ec-impact-row" role="group" aria-label="Impact filters">
            {(
              [
                ['high', 'High', 'high'],
                ['medium', 'Medium', 'med'],
                ['low', 'Low', 'low'],
                ['none', 'No Impact', 'none'],
                ['past', 'Past Events', 'none'],
              ] as const
            ).map(([key, label, tone]) => (
              <button
                key={key}
                type="button"
                className={`ec-pill${impacts.has(key) ? ' on' : ''}`}
                aria-pressed={impacts.has(key)}
                onClick={() => toggleImpact(key)}
              >
                <PlusIcon className={`ec-pill-dot ${tone}`} />
                {label}
              </button>
            ))}
          </div>

          <div className="ec-days" role="group" aria-label="Day selector">
            <div className="ec-days-scroll">
              {dayOptions
                .filter((d) => selectedDays.includes(d.offset))
                .map((d) => (
                  <button
                    key={d.offset}
                    type="button"
                    className={`ec-day${selectedDays.includes(d.offset) ? ' on' : ''}`}
                    aria-pressed={selectedDays.includes(d.offset)}
                    onClick={() => toggleDay(d.offset)}
                  >
                    {d.label}
                    <span>{d.count}</span>
                  </button>
                ))}
            </div>
            <div className="ec-add-day-wrap">
              <button
                type="button"
                className="ec-add-day"
                aria-expanded={addDayOpen}
                onClick={() => setAddDayOpen((o) => !o)}
              >
                <PlusIcon />
                Add day
              </button>
              {addDayOpen && (
                <div className="ec-add-day-menu">
                  {availableToAdd.length === 0 ? (
                    <p>All demo days selected</p>
                  ) : (
                    availableToAdd.map((d) => (
                      <button key={d.offset} type="button" onClick={() => addDay(d.offset)}>
                        {d.label} <span>{d.count}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div className="ec-empty">
            <p>No economic calendar data available</p>
            <p>Try adjusting your filters to see more results</p>
          </div>
        ) : (
          grouped.map(([key, events]) => (
            <section key={key} className="ec-day-section">
              <h2>{formatDayLabel(events[0].datetime)}</h2>
              <div className="ec-table-wrap">
                <table className="ec-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Ccy</th>
                      <th>Event</th>
                      <th>Impact</th>
                      <th className="end">Actual</th>
                      <th className="end">Forecast</th>
                      <th className="end">Previous</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <EventRow key={e.id} event={e} />
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="ec-cards">
                {events.map((e) => (
                  <EventCard key={`m-${e.id}`} event={e} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

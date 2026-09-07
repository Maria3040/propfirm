export type ImpactLevel = 'high' | 'medium' | 'low' | 'none';

export type CalendarEvent = {
  id: string;
  datetime: string;
  currency: string;
  country: string;
  title: string;
  impact: ImpactLevel;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
};

export const CALENDAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'NZD'] as const;

function dayOffset(days: number, hour: number, minute = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Demo economic calendar events relative to “today”. */
export const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'e1',
    datetime: dayOffset(0, 8, 30),
    currency: 'EUR',
    country: 'EU',
    title: 'German CPI (MoM)',
    impact: 'medium',
    actual: '0.2%',
    forecast: '0.2%',
    previous: '0.1%',
  },
  {
    id: 'e2',
    datetime: dayOffset(0, 12, 30),
    currency: 'USD',
    country: 'US',
    title: 'Nonfarm Payrolls',
    impact: 'high',
    actual: null,
    forecast: '165K',
    previous: '142K',
  },
  {
    id: 'e3',
    datetime: dayOffset(0, 12, 30),
    currency: 'USD',
    country: 'US',
    title: 'Unemployment Rate',
    impact: 'high',
    actual: null,
    forecast: '4.2%',
    previous: '4.1%',
  },
  {
    id: 'e4',
    datetime: dayOffset(0, 14, 0),
    currency: 'USD',
    country: 'US',
    title: 'Crude Oil Inventories',
    impact: 'low',
    actual: null,
    forecast: '-1.8M',
    previous: '-2.4M',
  },
  {
    id: 'e5',
    datetime: dayOffset(1, 2, 0),
    currency: 'JPY',
    country: 'JP',
    title: 'Tokyo Core CPI (YoY)',
    impact: 'medium',
    actual: null,
    forecast: '2.4%',
    previous: '2.5%',
  },
  {
    id: 'e6',
    datetime: dayOffset(1, 7, 0),
    currency: 'GBP',
    country: 'GB',
    title: 'BOE Interest Rate Decision',
    impact: 'high',
    actual: null,
    forecast: '4.00%',
    previous: '4.00%',
  },
  {
    id: 'e7',
    datetime: dayOffset(1, 9, 0),
    currency: 'EUR',
    country: 'EU',
    title: 'ECB Press Conference',
    impact: 'high',
    actual: null,
    forecast: null,
    previous: null,
  },
  {
    id: 'e8',
    datetime: dayOffset(1, 15, 0),
    currency: 'CAD',
    country: 'CA',
    title: 'Building Permits (MoM)',
    impact: 'low',
    actual: null,
    forecast: '1.1%',
    previous: '-2.3%',
  },
  {
    id: 'e9',
    datetime: dayOffset(2, 1, 30),
    currency: 'AUD',
    country: 'AU',
    title: 'RBA Rate Statement',
    impact: 'high',
    actual: null,
    forecast: null,
    previous: null,
  },
  {
    id: 'e10',
    datetime: dayOffset(2, 12, 15),
    currency: 'USD',
    country: 'US',
    title: 'Industrial Production (MoM)',
    impact: 'medium',
    actual: null,
    forecast: '0.3%',
    previous: '0.1%',
  },
  {
    id: 'e11',
    datetime: dayOffset(2, 18, 0),
    currency: 'CHF',
    country: 'CH',
    title: 'SNB Quarterly Bulletin',
    impact: 'none',
    actual: null,
    forecast: null,
    previous: null,
  },
  {
    id: 'e12',
    datetime: dayOffset(-1, 10, 0),
    currency: 'EUR',
    country: 'EU',
    title: 'Eurozone Retail Sales (YoY)',
    impact: 'medium',
    actual: '1.8%',
    forecast: '1.5%',
    previous: '1.2%',
  },
  {
    id: 'e13',
    datetime: dayOffset(-1, 13, 0),
    currency: 'USD',
    country: 'US',
    title: 'FOMC Member Speaks',
    impact: 'low',
    actual: null,
    forecast: null,
    previous: null,
  },
  {
    id: 'e14',
    datetime: dayOffset(-2, 8, 0),
    currency: 'GBP',
    country: 'GB',
    title: 'GDP (QoQ)',
    impact: 'high',
    actual: '0.1%',
    forecast: '0.1%',
    previous: '0.0%',
  },
  {
    id: 'e15',
    datetime: dayOffset(3, 12, 30),
    currency: 'USD',
    country: 'US',
    title: 'Initial Jobless Claims',
    impact: 'medium',
    actual: null,
    forecast: '225K',
    previous: '231K',
  },
  {
    id: 'e16',
    datetime: dayOffset(3, 14, 0),
    currency: 'NZD',
    country: 'NZ',
    title: 'BusinessNZ PMI',
    impact: 'low',
    actual: null,
    forecast: '52.0',
    previous: '51.4',
  },
];

export function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDayLabel(isoOrDate: string | Date) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const today = startOfLocalDay();
  const target = startOfLocalDay(d);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

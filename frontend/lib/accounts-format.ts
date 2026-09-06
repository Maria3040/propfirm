export type ChallengeRow = {
  id: string;
  sku: string;
  status: string;
  accountSize: number;
  currentPhase: number;
  phases: number;
  equity?: number;
  pnl?: number;
  profitPct?: number;
  login?: string | null;
  platform?: string | null;
  createdAt?: string;
};

export function sizeLabel(n: number) {
  return n >= 1000 ? `$${n / 1000}k` : `$${n}`;
}

export function money(n: number | null | undefined, signed = true) {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  const sign = signed && safe > 0 ? '+' : '';
  const prefix = safe < 0 ? '-' : sign;
  return `${prefix}$${Math.abs(safe).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function moneyPlain(n: number | null | undefined) {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return `$${safe.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'funded') return 'acc-pill ok';
  if (s === 'failed' || s === 'closed' || s === 'cancelled') return 'acc-pill bad';
  return 'acc-pill';
}

export function typeLabel(sku: string) {
  const lower = sku.toLowerCase();
  if (lower.includes('compet')) return 'Competition';
  if (lower.includes('zero')) return 'Zero';
  if (lower.includes('one') || lower.includes('1step') || lower.includes('1_step')) return '1 Step';
  if (lower.includes('two') || lower.includes('2step') || lower.includes('2_step')) return '2 Step';
  return sku.split(/[-_]/)[0] || 'Challenge';
}

export function phaseLabel(c: { status: string; currentPhase: number; phases: number }) {
  if (c.status === 'Funded' || c.currentPhase > c.phases) return 'Funded';
  return `Phase ${c.currentPhase}`;
}

export function accountNo(c: ChallengeRow) {
  return c.login || c.id.slice(0, 9);
}

export function isArchived(status: string) {
  return ['Failed', 'Closed', 'Cancelled'].includes(status);
}

export function tradingDisabled(status: string) {
  return ['Failed', 'Closed', 'Cancelled'].includes(status);
}

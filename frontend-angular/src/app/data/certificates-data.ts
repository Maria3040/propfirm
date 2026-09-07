export type PayoutCertificate = {
  id: string;
  traderName: string;
  amount: number;
  currency: string;
  paidAt: string;
  accountSize: string;
  challenge: string;
  method: string;
  country: string;
};

type ApprovedPayoutRow = {
  id: string;
  amount: number | string;
  status: string;
  challengeId?: string | null;
  method?: string | null;
  rewardType?: string | null;
  cryptoNetwork?: string | null;
  createdAt: string;
  decidedAt?: string | null;
};

type ChallengeLite = {
  id: string;
  sku?: string;
  accountSize?: number;
};

export function formatCertAmount(amount: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatCertDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function methodLabel(method?: string | null, network?: string | null) {
  const m = (method || '').toLowerCase();
  if (m === 'crypto') {
    return network ? `Crypto · ${network}` : 'Crypto';
  }
  if (m === 'bank') return 'Bank transfer';
  if (m === 'rise') return 'Rise';
  return method || 'Payout';
}

/** Map approved payout API rows into certificate cards (no demo fixtures). */
export function certificatesFromApprovedPayouts(
  rows: ApprovedPayoutRow[],
  traderName: string,
  challenges: ChallengeLite[] = [],
): PayoutCertificate[] {
  const byId = new Map(challenges.map((c) => [c.id, c]));
  return rows
    .filter((r) => String(r.status || '').toLowerCase() === 'approved')
    .map((r) => {
      const ch = r.challengeId ? byId.get(r.challengeId) : undefined;
      const size = ch?.accountSize;
      return {
        id: `PF-CERT-${r.id.slice(0, 8).toUpperCase()}`,
        traderName,
        amount: Number(r.amount) || 0,
        currency: 'USD',
        paidAt: r.decidedAt || r.createdAt,
        accountSize: size ? `$${Number(size).toLocaleString()}` : '—',
        challenge: ch?.sku || (r.challengeId ? `Account ${r.challengeId.slice(0, 8)}` : 'Funded account'),
        method: methodLabel(r.method, r.cryptoNetwork),
        country: '',
      };
    });
}

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

/** Demo reward certificates for completed trading payouts. */
export const PAYOUT_CERTIFICATES: PayoutCertificate[] = [
  {
    id: 'PF-CERT-2026-0842',
    traderName: 'Alex Trader',
    amount: 4850,
    currency: 'USD',
    paidAt: '2026-08-14T12:00:00.000Z',
    accountSize: '$100,000',
    challenge: 'Two-Step Evaluation',
    method: 'Crypto · USDT (TRC20)',
    country: 'US',
  },
  {
    id: 'PF-CERT-2026-0711',
    traderName: 'Alex Trader',
    amount: 2120.5,
    currency: 'USD',
    paidAt: '2026-07-02T09:30:00.000Z',
    accountSize: '$50,000',
    challenge: 'One-Step Evaluation',
    method: 'Rise',
    country: 'US',
  },
  {
    id: 'PF-CERT-2026-0590',
    traderName: 'Alex Trader',
    amount: 975,
    currency: 'USD',
    paidAt: '2026-05-21T16:45:00.000Z',
    accountSize: '$25,000',
    challenge: 'Two-Step Evaluation',
    method: 'Bank transfer',
    country: 'US',
  },
];

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

export const AFFILIATE_CODE = 'PF7A2C91';

export function affiliateReferralUrl(origin = 'http://localhost:3100') {
  return `${origin.replace(/\/$/, '')}/register?referral_code=${AFFILIATE_CODE}`;
}

export type AffiliateReward = {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  status: 'locked' | 'in_progress' | 'claimable' | 'claimed';
};

export type AffiliateReferral = {
  id: string;
  email: string;
  joinedAt: string;
  status: 'pending' | 'qualified' | 'paid';
  commission: number;
};

export type EarningsPoint = {
  date: string;
  amount: number;
  cumulative: number;
};

/** Demo affiliate stats for the PropFirm showcase. */
export const AFFILIATE_STATS = {
  totalReferrals: 12,
  totalPaidOut: 1840.5,
  availableBalance: 326.75,
};

export const AFFILIATE_REFERRALS: AffiliateReferral[] = [
  {
    id: 'r1',
    email: 'm***@gmail.com',
    joinedAt: '2026-08-28',
    status: 'paid',
    commission: 145,
  },
  {
    id: 'r2',
    email: 'a***@outlook.com',
    joinedAt: '2026-08-21',
    status: 'qualified',
    commission: 89.5,
  },
  {
    id: 'r3',
    email: 'j***@yahoo.com',
    joinedAt: '2026-08-12',
    status: 'paid',
    commission: 210,
  },
  {
    id: 'r4',
    email: 's***@icloud.com',
    joinedAt: '2026-07-30',
    status: 'pending',
    commission: 0,
  },
  {
    id: 'r5',
    email: 't***@proton.me',
    joinedAt: '2026-07-18',
    status: 'paid',
    commission: 175,
  },
];

export const AFFILIATE_REWARDS: AffiliateReward[] = [
  {
    id: 'rw1',
    title: 'Starter',
    description: 'Earn your first 5 qualified referrals.',
    progress: 5,
    target: 5,
    status: 'claimed',
  },
  {
    id: 'rw2',
    title: 'Growth',
    description: 'Reach $1,000 in lifetime commissions.',
    progress: 1840.5,
    target: 1000,
    status: 'claimed',
  },
  {
    id: 'rw3',
    title: 'Pro Partner',
    description: 'Refer 25 traders who purchase a challenge.',
    progress: 12,
    target: 25,
    status: 'in_progress',
  },
  {
    id: 'rw4',
    title: 'Elite',
    description: 'Unlock higher commission tiers at 50 referrals.',
    progress: 12,
    target: 50,
    status: 'locked',
  },
];

function dayOffset(daysAgo: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Daily commission points for the earnings chart (oldest → newest). */
export const EARNINGS_SERIES: EarningsPoint[] = (() => {
  const daily = [0, 45, 0, 120, 80, 0, 35, 210, 0, 55, 145, 89.5, 0, 0, 175];
  let cum = 0;
  return daily.map((amount, i) => {
    cum += amount;
    return {
      date: dayOffset(daily.length - 1 - i),
      amount,
      cumulative: cum,
    };
  });
})();

export function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatShortDate(iso: string) {
  return new Date(iso + (iso.length <= 10 ? 'T12:00:00' : '')).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export const SETTINGS_NAV = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/verify', label: 'Account Verification' },
  { href: '/settings/security', label: 'Security' },
  { href: '/settings/bank-accounts', label: 'Bank Accounts' },
  { href: '/settings/credit-cards', label: 'Credit Cards' },
  { href: '/settings/crypto-wallets', label: 'Crypto Wallets' },
  { href: '/settings/payment-history', label: 'Payment History' },
  { href: '/settings/discord', label: 'Discord' },
  { href: '/settings/early-access', label: 'Early Access' },
  { href: '/settings/feature-suggestions', label: 'Feature Suggestions' },
  { href: '/settings/preferences', label: 'Preferences' },
] as const;

export type ProfileFormData = {
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  timeZone: string;
  street: string;
  city: string;
  postcode: string;
  country: string;
};

export const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'Mx.'] as const;

export const TIME_ZONES = [
  { id: 'UTC', label: 'UTC — Coordinated Universal Time' },
  { id: 'America/New_York', label: '−05:00 Eastern Time — New York' },
  { id: 'America/Chicago', label: '−06:00 Central Time — Chicago' },
  { id: 'America/Los_Angeles', label: '−08:00 Pacific Time — Los Angeles' },
  { id: 'Europe/London', label: '+00:00 UK Time — London' },
  { id: 'Europe/Berlin', label: '+01:00 Central European — Berlin' },
  { id: 'Europe/Istanbul', label: '+03:00 Turkey Time — Istanbul, Ankara, Bursa, İzmir' },
  { id: 'Asia/Dubai', label: '+04:00 Gulf Time — Dubai' },
  { id: 'Asia/Singapore', label: '+08:00 Singapore Time' },
  { id: 'Asia/Tokyo', label: '+09:00 Japan Time — Tokyo' },
  { id: 'Australia/Sydney', label: '+10:00 Australian Eastern — Sydney' },
] as const;

export const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Germany',
  'France',
  'Netherlands',
  'Spain',
  'Italy',
  'Turkey',
  'Moldova, Republic of',
  'United Arab Emirates',
  'Singapore',
  'Australia',
  'Japan',
  'Romania',
  'Poland',
] as const;

const STORAGE_KEY = 'propfirm_profile';

export function defaultProfile(email = '', displayName = ''): ProfileFormData {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    title: 'Mr.',
    firstName: parts[0] || 'Alex',
    lastName: parts.slice(1).join(' ') || 'Trader',
    dateOfBirth: '1990-01-15',
    email: email || 'trader@propfirm.local',
    timeZone: 'Europe/Istanbul',
    street: '',
    city: '',
    postcode: '',
    country: 'United States',
  };
}

export function loadProfile(email?: string, displayName?: string): ProfileFormData {
  const base = defaultProfile(email, displayName);
  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<ProfileFormData>;
    return {
      ...base,
      ...saved,
      email: email || saved.email || base.email,
    };
  } catch {
    return base;
  }
}

export function saveProfile(data: ProfileFormData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

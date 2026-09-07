import type { BasketLine } from './basket-types';

const KEY = 'propfirm_basket';
const EVENT = 'propfirm-basket-change';

export type StoredBasket = {
  items: BasketLine[];
  currency: string;
};

export function readBasket(): StoredBasket {
  if (typeof window === 'undefined') return { items: [], currency: 'USD' };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { items: [], currency: 'USD' };
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
    return {
      items,
      currency: typeof parsed?.currency === 'string' ? parsed.currency : 'USD',
    };
  } catch {
    return { items: [], currency: 'USD' };
  }
}

export function writeBasket(items: BasketLine[], currency = 'USD') {
  if (typeof window === 'undefined') return;
  const next: StoredBasket = { items, currency };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function basketCount(items: BasketLine[] = readBasket().items) {
  return items.reduce((n, i) => n + (i.qty || 0), 0);
}

export function basketTotal(items: BasketLine[] = readBasket().items) {
  return items.reduce((n, i) => n + i.unitPrice * i.qty, 0);
}

export function subscribeBasket(cb: (b: StoredBasket) => void) {
  const handler = () => cb(readBasket());
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

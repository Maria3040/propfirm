import { beforeEach, describe, expect, it, vi } from 'vitest';
import { basketCount, basketTotal, readBasket, writeBasket } from './basket';
import type { BasketLine } from '@/components/BasketCheckout';

const sample: BasketLine = {
  key: 'a',
  productId: 'p1',
  title: '50K Flex',
  platform: 'MetaTrader 5',
  platformShort: 'MT5',
  accountSize: 50_000,
  unitPrice: 100,
  swapFree: false,
  qty: 2,
};

describe('basket (unit / edge)', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    vi.stubGlobal(
      'window',
      Object.assign(globalThis, {
        localStorage: globalThis.localStorage,
        dispatchEvent: () => true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    );
  });

  it('starts empty', () => {
    expect(readBasket()).toEqual({ items: [], currency: 'USD' });
    expect(basketCount([])).toBe(0);
  });

  it('writes and counts quantities', () => {
    writeBasket([sample], 'USD');
    expect(basketCount(readBasket().items)).toBe(2);
    expect(basketTotal(readBasket().items)).toBe(200);
  });

  it('recovers from corrupt localStorage JSON (edge)', () => {
    localStorage.setItem('propfirm_basket', '{not-json');
    expect(readBasket()).toEqual({ items: [], currency: 'USD' });
  });
});

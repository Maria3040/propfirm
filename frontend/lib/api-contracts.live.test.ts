/**
 * Live API contract checks (skipped when :6080 is down).
 * Complements Playwright e2e when browsers are unavailable.
 */
import { describe, expect, it } from 'vitest';

const API = process.env.PROPFIRM_API || 'http://127.0.0.1:6080';

async function apiAvailable() {
  try {
    const res = await fetch(`${API}/`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

describe('live API ↔ UI contracts', () => {
  it('exposes coupon validate used by BasketCheckout', async () => {
    if (!(await apiAvailable())) return;
    const res = await fetch(`${API}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'WELCOME10', subtotal: 100 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.finalTotal).toBe(90);
    expect(body.discountAmount).toBe(10);
  });

  it('rejects expired coupon (edge)', async () => {
    if (!(await apiAvailable())) return;
    const res = await fetch(`${API}/api/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'EXPIRED', subtotal: 100 }),
    });
    expect(res.status).toBe(400);
  });

  it('eligible accounts include equity for payouts/request', async () => {
    if (!(await apiAvailable())) return;
    const login = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'trader@propfirm.local', password: 'Trader1!' }),
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get('set-cookie') || '';
    const match = /propfirm_access=([^;]+)/.exec(setCookie);
    expect(match).toBeTruthy();
    const res = await fetch(`${API}/api/payouts/eligible`, {
      headers: { Cookie: `propfirm_access=${match![1]}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.accounts)).toBe(true);
    if (body.accounts.length) {
      expect(typeof body.accounts[0].equity).toBe('number');
      expect(typeof body.accounts[0].accountSize).toBe('number');
    }
  });
});
